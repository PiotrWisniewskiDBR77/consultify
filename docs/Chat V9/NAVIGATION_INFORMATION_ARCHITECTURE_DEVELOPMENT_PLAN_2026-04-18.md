# NAVIGATION / INFORMATION ARCHITECTURE — development plan (develop branch, 2026-04-18)

Honest plan: only features whose code has actually landed on `develop`
are documented here. See `README.md` in this folder for the project-wide
index.

> **Cross-refs**
> - Kill-switches & incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new navigation feature → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md)

## Scope

The NAVIGATION audit flagged a specific dead-end in the current
IA: a user who is mid-conversation and navigates / deep-links to
an artifact or module view has **no consistent affordance to get
back to the chat**. Each module renders its own header; the sidebar
is not always visible; the browser back button is only reliable
when the user *came from* chat. The result is a path-loss
experience that punishes every cross-module click.

The first milestone closes that gap with a minimally invasive
global affordance. Later work (NA4 "Moja praca" hub, NA5 IA map
in help, NA6 recently-opened artifacts in sidebar) has already
landed in earlier waves and is documented elsewhere.

## Shipped

<a id="nav-m1"></a>

### NAV-M1 · Back-to-chat floating button

- **Effort**: XS
- **Priority**: P0 (unblocks every non-chat view)
- **Risk**: very low — wraps an existing `returnToFullChat()`
  action, purely additive, kill-switchable
- **Status**: ✅ shipped
- **Flag**: `back-to-chat-button` (`ff_backToChatButton=1|0`),
  default ON

What landed:

- `src/utils/backToChatButtonFlag.ts` — standard URL > localStorage
  > env > default ON resolver.
- `src/components/navigation/BackToChatButton.tsx` — a `fixed`
  top-right pill (below typical header chrome at `top-14`,
  `z-[80]` so the flag overlay and indicator still win). The
  button renders only when **all** of these hold:
  1. flag is ON,
  2. `currentView` is neither `AI_CHAT` nor `WELCOME`,
  3. `activeConversationId` (from `useConversationStore`) is set,
  4. `returnToFullChat` is a function on the UI slice.
- Clicking fires
  `trackFunnelEvent('navigation_back_to_chat_clicked', { fromView })`
  — `fromView` is the closed `AppView` enum value, RODO-safe
  (no ids, no user content). Telemetry failures never block
  navigation; the nav is the high-value side effect.
- Mounted once globally in `src/App.tsx` next to the admin
  overlay / indicator. Non-chat, no-conversation, and
  flag-disabled sessions render nothing.

### DoD

- On `AppView.AI_CHAT` → button returns null (we are already
  there).
- On `AppView.WELCOME` or before any conversation exists →
  returns null (nothing to return *to*).
- On every other view with an `activeConversationId` → button
  visible in the top-right corner, keyboard-focusable, with
  `aria-label="Back to active conversation"`.
- Clicking fires exactly one `navigation_back_to_chat_clicked`
  event with the correct `fromView` then calls
  `returnToFullChat()` — the existing UI-slice action that
  updates `currentView` and triggers the router navigation.
- Flag OFF (URL / localStorage / env) → component returns null
  regardless of view or conversation state. Sidebar / browser
  back / per-module headers are unchanged.

### Deliberately out of scope (v1)

- **Conversation title in the button label.** The pill reads
  "Back to chat" uniformly. Showing the title would tempt us to
  leak conversation content into a DOM attribute that
  server-side rendering may cache; the whole component is
  deliberately content-free.
- **Hover preview of the conversation.** Same reasoning —
  preview requires pulling the first message / title into the
  button's tree. Out of scope until we have a RODO-safe preview
  surface.
- **Per-view placement tuning.** Today the pill sits in one
  fixed corner. Modules with a conflicting top-right element
  (e.g. a future floating filter) can either move their element
  or raise a follow-up to expose a per-view positioning prop.
- **Keyboard shortcut.** `⌘/Ctrl + B` would collide with the
  sidebar toggle on many platforms; deferring until we have a
  full shortcut registry. (Superseded by **NAV-M1.1** below —
  we chose `Alt+Shift+C` instead.)

<a id="nav-m1-1"></a>

### NAV-M1.1 · Back-to-chat keyboard shortcut

- **Effort**: XS
- **Priority**: P1 (keyboard-parity with NAV-M1's visible pill)
- **Risk**: very low — headless, single global `keydown` listener,
  guarded against editable-element focus and open modals
- **Status**: ✅ shipped
- **Flag**: `back-to-chat-shortcut` (`ff_backToChatShortcut=1|0`),
  default ON — independent from `back-to-chat-button` so either
  surface can be killed without the other.

What landed:

- `src/utils/backToChatShortcutFlag.ts` — standard
  URL > localStorage > env > default ON resolver.
- `src/components/navigation/BackToChatShortcut.tsx` — a headless
  component (renders `null`) that mounts one global
  `window.addEventListener('keydown', …)` and disposes it on
  unmount. Fires when **all** of these hold:
  1. flag is ON,
  2. `event.altKey && event.shiftKey`, exactly (`ctrlKey` and
     `metaKey` must be false so browser DevTools / OS shortcuts
     keep working),
  3. `event.key === 'c'` **or** `event.code === 'KeyC'` — the
     fallback to `event.code` catches macOS Option+C producing
     `"ç"`,
  4. `currentView` is neither `AI_CHAT` nor `WELCOME`,
  5. `activeConversationId` is set,
  6. `returnToFullChat` is a function,
  7. the active target is not `<input>` / `<textarea>` /
     `<select>` / `[contenteditable]`,
  8. no element in the document has `aria-modal="true"` (don't
     cancel an open confirm dialog).
- On match: `preventDefault()` + `stopPropagation()`, emit
  `navigation_back_to_chat_shortcut` (payload `{ fromView }`, the
  closed `AppView` enum — RODO-safe), then call
  `returnToFullChat()`. Telemetry failures never block
  navigation.
- Mounted once globally in `src/App.tsx` next to the NAV-M1
  button.

### DoD

- Pressing `Alt+Shift+C` (Win/Linux) or `Option+Shift+C` (macOS)
  on any non-chat view with an active conversation navigates
  back to the active conversation and emits exactly one
  `navigation_back_to_chat_shortcut` event.
- The same combo on `AI_CHAT` or `WELCOME`, or with no active
  conversation, is a no-op — nothing is emitted, nothing
  navigates.
- The combo is a no-op while focus is inside a text input /
  textarea / contenteditable — typing `C` in a form never
  silently leaves the page.
- The combo is a no-op while any open modal has
  `aria-modal="true"` — the modal's own controls stay in charge.
- Flag OFF (URL / localStorage / env) → listener is never
  attached; `Alt+Shift+C` is inert and the NAV-M1 pill is the
  sole way back.

### Deliberately out of scope (v1)

- **In-app keyboard-shortcut registry / cheatsheet.** `⇧⌘/` help
  overlay is a separate block (NAV map in help). Today the
  shortcut is only documented here and in the overlay runbook.
- **Per-conversation "go to conversation N" shortcuts.** Scoping
  them requires a conversation list surface with stable ordering;
  deferred until NAV-M1.1 usage telemetry says the primary
  shortcut is adopted enough to justify the discoverability cost.
- **Configurable binding.** Users cannot remap the shortcut.
  `Alt+Shift+C` was picked specifically because no other
  shipping V9 surface binds it; when we add more shortcuts we'll
  land a real registry rather than per-feature remapping.

<a id="nav-m2-lite"></a>

### NAV-M2-lite · Workspace breadcrumb pill

**Rationale.** Users who follow the NAV-M1 flow (jump from chat
into a workspace view, e.g. `Assessment · SIRI`, then get pulled
into an email / Slack thread, then come back to the tab) report a
"where am I?" beat before they find the sidebar. The full NAV-M2
ticket is a multi-level breadcrumb normalised across every
module's own header — weeks of design work across 20+ views. This
`-lite` slice ships the wayfinding value of the full ticket as a
single floating pill that runs from a pure, unit-testable builder
and touches zero per-module layouts.

**What shipped.**

- `src/utils/buildWorkspaceBreadcrumb.ts` — pure builder. Returns
  `null` on hidden views (`AI_CHAT` / `WELCOME` / `AUTH`), on
  missing `activeConversationId`, and on degraded inputs. When
  visible, produces a two-segment structure: `[{ label: 'Chat',
  role: 'chat-link' }, { label: <view label>, role: 'current' }]`.
  The current-view label comes from a curated `AppView` → string
  map (~25 workspace views — Discovery Tools, Assessment
  frameworks, Wordy / Excele / Prezentacje, Reports, KPI/OKR,
  Masterclass, Resources, etc.) with a deterministic humaniser
  fallback: 1-chunk → `Dashboard`, 2-chunk → `Partner commission`
  (sentence case to match curated labels), 3+ chunks →
  `Assessment · Digital external` (head · rest). The fallback
  never produces empty output.
- `src/utils/workspaceBreadcrumbFlag.ts` —
  `ff.workspace_breadcrumb` kill-switch (default ON).
- `src/components/navigation/WorkspaceBreadcrumb.tsx` — floating
  pill mounted at the App root, positioned
  `fixed top-14 left-1/2 -translate-x-1/2 z-[80]`. Top-center
  avoids sidebar overlap (neither the left workspace rail nor the
  right `BackToChatButton` collide with center). The `Chat`
  segment is a `<button>` that calls `returnToFullChat()` — the
  exact same action NAV-M1 and NAV-M1.1 use, so the three exits
  stay behaviourally identical. The current-view segment is plain
  text with `aria-current="page"`. Injectable `isEnabled` and
  `build` seams for tests; production never passes them.
- `src/App.tsx` — mounts `<WorkspaceBreadcrumb />` immediately
  after `<BackToChatButton />` for obvious visual pairing.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `workspace-breadcrumb` (ticket `NAV-M2`, block `navigation`,
  `testId: 'workspace-breadcrumb'`) so the AG1 admin panel shows
  the kill-switch and links back to this plan.
- Tests: `buildWorkspaceBreadcrumb.test.ts` (16 cases — hidden
  views, missing conversation, nullish input, curated vs
  humanised labels, segment shape invariants, deterministic
  formatter covering 1 / 2 / 3+ chunks + consecutive-underscore
  edge case + empty input). `WorkspaceBreadcrumb.test.tsx` (11
  cases — flag OFF, hidden view, no conversation, missing
  `returnToFullChat`, curated label render, `aria-current` on
  current segment, Chat-is-button invariant, click wires
  `returnToFullChat`, zero telemetry contract, nav a11y wrapper,
  injected builder seam).

**DoD.**

- [x] On every non-chat workspace view with an active
      conversation, a `Chat › <view label>` pill renders top-center
      and the `Chat` segment returns the user to the active
      conversation on click.
- [x] On `AI_CHAT` / `WELCOME` / `AUTH`, or when no conversation
      exists, the component returns `null` — never paints.
- [x] Kill-switch (`?ff_workspaceBreadcrumb=0` or
      `localStorage['ff.workspace_breadcrumb'] = '0'`) restores the
      pre-NAV-M2-lite layout pixel-for-pixel.
- [x] Zero telemetry events fire from the breadcrumb path — the
      existing `navigation_back_to_chat_clicked` event already
      answers "users returned to chat".
- [x] Unmapped `AppView` tokens still produce a non-empty,
      human-readable label via the humaniser; no blank pill, no
      `VIEW_SCREAM_CASE` leaking into the UI.

**Deliberately out of scope.**

- Multi-level hierarchy (`Chat › Assessment › SIRI`). The shipped
  shape is two segments; a deeper tree requires per-module
  metadata the current enum does not carry and is the real
  NAV-M2 ticket.
- Active conversation title as a third segment. Shipped as the
  follow-up ticket `NAV-M2-lite+` — see below.
- Localisation. Labels are English-only, matching the rest of the
  Chat V9 admin / trust surfaces.
- Clickable current-view segment. By design — a breadcrumb
  segment that navigates to the page you are already on is user-
  hostile.
- Per-breadcrumb telemetry. NAV-M1 already captures the "user
  returned to chat" signal; a duplicate breadcrumb-click event
  would cost a RODO review for marginal dashboard value.

<a id="nav-m2-lite-plus"></a>

<a id="nav-m2-lite-plus"></a>

### NAV-M2-lite+ · Active conversation title as 3rd breadcrumb segment

**Why.** NAV-M2-lite ships wayfinding at the level of "which view
am I on", but on dense days a single workspace view (e.g.
`Assessment · SIRI`) can hold many conversations. Without the
conversation name in the breadcrumb, the user has to mentally map
`active sidebar item` onto `current view` to confirm which chat
they are operating inside. Adding the conversation title as a
third segment closes that gap and — because the title is already
persisted by the chat stack — requires zero new data plumbing.

**Behaviour.**

- When the active conversation has a non-empty title and the new
  kill-switch is ON, the pill renders as
  `Chat › <view label> › <conversation title>`; the middle view
  segment demotes from `current` to `view` (plain, non-`aria-
  current`), and the trailing conversation-title segment owns the
  `aria-current="page"` marker.
- When the title is missing, blank, or the kill-switch is OFF,
  the pill collapses back to the NAV-M2-lite two-segment shape.
  The base `ff.workspace_breadcrumb` flag remains the outer safety
  net; turning the base flag OFF hides the pill entirely.
- The title is trimmed, then truncated to
  `WORKSPACE_BREADCRUMB_TITLE_MAX` (32) characters with a trailing
  `…` when longer. The untruncated title rides along in the
  segment's `title` field and renders as the browser tooltip via
  `<span title=…>`, so hover still shows the full conversation
  name without letting the pill widen across the viewport.
- The conversation-title segment is non-interactive — clicking it
  does nothing. Only the `Chat` segment is a button, and it keeps
  the original NAV-M1 semantics of calling `returnToFullChat()`.

**Delivered.**

- `consultify/src/utils/buildWorkspaceBreadcrumb.ts`: extended
  with `conversationTitle` + `conversationSegmentEnabled` inputs,
  a new `'view'` role, a deterministic truncation helper, and a
  `WORKSPACE_BREADCRUMB_TITLE_MAX` export that tests and CSS can
  line up against.
- `consultify/src/utils/workspaceBreadcrumbConversationFlag.ts`
  (NEW): standard Chat V9 resolver (URL → localStorage → env →
  default ON) for the conversation-segment kill-switch.
- `consultify/src/components/navigation/WorkspaceBreadcrumb.tsx`:
  reads the active conversation title from `useConversationStore`
  by `id` (memoised so the recent-sidebar reshuffle does not
  churn renders), forwards it to the builder, renders the new
  `view` role as a non-current span, and surfaces the
  `segment.title` as the hover tooltip on truncated labels.
- `consultify/src/utils/chatV9FeatureFlags.ts`: registered as
  `workspace-breadcrumb-conversation` (ticket `NAV-M2.1`, block
  `navigation`).

**DoD.**

- [x] A fully-loaded workspace view with an active titled
      conversation shows three segments, with the conversation
      title as the trailing `aria-current="page"` element.
- [x] Turning the extension flag OFF (via URL query,
      localStorage, or env) collapses the pill back to the
      NAV-M2-lite shape without re-mounting the component.
- [x] Turning the base `ff.workspace_breadcrumb` OFF still hides
      the entire pill (outer safety net preserved).
- [x] Long titles are truncated to 32 chars + `…` and the full
      title is available as a DOM `title=` tooltip.
- [x] The conversation-title segment is not a button, is not
      focusable, and never calls `returnToFullChat()`.
- [x] Zero new telemetry events fire — the trailing segment is
      pure wayfinding, same contract as NAV-M2-lite.

**Deliberately out of scope.**

- Editing the conversation title from the breadcrumb. The chat
  header already owns rename UX; duplicating it in the pill would
  break the "segment you are on is not a button" invariant.
- Navigating to sibling conversations from the breadcrumb. That
  is the follow-up ticket `NAV-M3-lite` — see below; it adds a
  small caret button next to the `Chat` segment that opens a
  recents-conversations popover.
- Per-conversation PII redaction. Titles are already user- or AI-
  authored strings that live in the sidebar; if a title is too
  sensitive for the breadcrumb it is also too sensitive for the
  sidebar, which is the canonical place to fix it.
- Localisation of the truncation marker. Unicode `…` works across
  all current locales; it is intentionally kept as a single code
  point so the DOM `title=` tooltip restores the full text
  verbatim.

<a id="nav-m3-lite"></a>

<a id="nav-m3-lite"></a>

### NAV-M3-lite · Recent conversations dropdown on the breadcrumb

**Why.** NAV-M2-lite+ tells the user *which* conversation they
are in, but hopping to a sibling still requires a round-trip to
the sidebar — which on a workspace view (assessment, roadmap,
SIRI) is either collapsed or mentally out of reach. The full
"quick-switcher" ticket is a `Cmd+K` palette with fuzzy search
and keyboard navigation; this `-lite` slice buys 80% of the
value by adding a small caret button next to the `Chat` segment
that opens the five most-recent siblings in a popover. Selecting
one routes through the existing `setActiveConversation` +
`returnToFullChat` verbs so the user always lands in chat on the
chosen conversation — same terminal state as NAV-M1 / NAV-M1.1 /
NAV-M2-lite.

**Behaviour.**

- When the `ff.workspace_breadcrumb_recents` kill-switch is ON
  (default) and the filtered recents list is non-empty, a small
  `▾` caret button renders directly after the `Chat` segment
  inside the breadcrumb pill. When the list is empty (only one
  conversation in the workspace, all other threads archived /
  deleted / untitled), the caret is hidden — we do not dangle
  an empty popover.
- Clicking the caret opens a 64 px-wide popover listing the
  entries from `buildRecentConversationsList`. The popover has
  `role="menu"`, each row is a `role="menuitem"` button, and
  opening it moves focus to the first row so keyboard users can
  press `Enter` immediately.
- Selecting a row calls `setActiveConversation(id)` followed by
  `returnToFullChat()`, then closes the popover. A thrown
  `setActiveConversation` (optimistic-update race) does not
  block the chat return: the user still lands on the main chat
  surface — the safe failure mode.
- Escape closes the popover. Document-level `mousedown` outside
  the popover closes it (same pattern `TrustBadge` uses).
- When the kill-switch is OFF, the caret does not render at all
  and the builder is not called — zero runtime work. The
  breadcrumb collapses back to the NAV-M2.1 shape pixel-for-
  pixel.

**Filtering / sorting contract (`buildRecentConversationsList`).**

- Excludes the currently active conversation (`id ===
  activeConversationId`) — "jump to yourself" is dead UX.
- Excludes `archived === true` rows. Archived threads are a
  sidebar affair; surfacing them in the recents popover would
  invert their purpose.
- Excludes soft-deleted rows (`deletedAt` non-null, non-empty,
  non-whitespace).
- Excludes rows with empty / whitespace-only `title`. A
  "Untitled" row wastes a slot at the top of a 5-row popover.
- Sorts newest-first by `lastMessageAt`, falling back to
  `updatedAt` when missing / unparseable; ties broken by
  `id.localeCompare` for determinism.
- Caps the list at `DEFAULT_MAX_RECENT_CONVERSATIONS` (5).
- Truncates titles above `RECENT_CONVERSATION_TITLE_MAX` (40
  chars) to `<first 39 chars>…`; the full title is surfaced via
  `title=` tooltip on truncated rows only.

**Delivered.**

- `src/utils/workspaceBreadcrumbRecentsFlag.ts` (NEW) —
  `ff.workspace_breadcrumb_recents` kill-switch (default ON)
  with the standard URL → localStorage → env → default
  resolution order.
- `src/utils/buildRecentConversationsList.ts` (NEW) — pure
  filter / sort / truncate builder returning
  `RecentConversationEntry[]`. Defensive against null /
  non-array inputs, non-string ids, Date / number / string
  timestamps, and negative / zero `maxItems`.
- `src/components/navigation/RecentConversationsDropdown.tsx`
  (NEW) — controlled popover component. Takes `entries`,
  `open`, `onOpenChange`, `onSelect`, and an optional
  `className`. Opens with `aria-haspopup="menu"` on the trigger
  and `role="menu"` on the popover. Escape + outside-click
  close handlers attach only while `open`.
- `src/components/navigation/WorkspaceBreadcrumb.tsx` — wires
  `setActiveConversation` from `useConversationStore`, computes
  the recents list via the pure builder, and renders the
  dropdown inline with the `Chat` segment. Selection calls
  `setActiveConversation(id)` in a try/catch, then
  `returnToFullChat()` unconditionally.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `workspace-breadcrumb-recents` (ticket `NAV-M3`, block
  `navigation`, empty `telemetry` array, `testId:
  'workspace-breadcrumb'`).
- Tests: `buildRecentConversationsList.test.ts` (17 cases
  covering null / empty / zero-max inputs, active-id filter,
  archived / deleted / blank-title filters, newest-first sort
  with updatedAt fallback, deterministic tie-break, max-items
  cap, truncation with tooltip, non-string-id defensive skip,
  Date / number timestamp acceptance, final "never active,
  never blank" invariant). `RecentConversationsDropdown.test.
  tsx` (13 cases: empty-array null render, trigger a11y
  attributes, menu hidden when closed, full list rendered when
  open, trigger click toggle, menuitem click fires select +
  close, tooltip only for truncated, Escape closes, outside
  mousedown closes, inside mousedown ignored, className
  append, aria-expanded reflects open). Extends
  `WorkspaceBreadcrumb.test.tsx` with 7 new NAV-M3-lite cases:
  caret hidden when kill-switch OFF (builder not called),
  caret hidden when recents empty, caret renders + popover
  opens on click, selection calls `setActiveConversation(id)`
  then `returnToFullChat()` in order, store throw still
  returns to chat, builder receives the raw conversations +
  activeId, zero telemetry emitted.

**DoD.**

- [x] With recents present, the caret is visible and the
      popover lists up to 5 non-active, non-archived, non-
      deleted, non-blank-title siblings.
- [x] Selecting a row always results in the user being on the
      main chat surface with the selected conversation active.
- [x] Kill-switch OFF hides the caret entirely, the builder is
      not called, and the breadcrumb is pixel-for-pixel
      identical to NAV-M2.1.
- [x] Popover closes on Escape, on outside mousedown, on
      selection, and never via selection-inside the popover.
- [x] `setActiveConversation` throwing does not crash the
      component; the user still lands in chat.
- [x] Zero new telemetry events. Navigation signal is already
      covered by `navigation_back_to_chat_clicked`.

**Deliberately out of scope.**

- `Cmd+K` palette / fuzzy search. That is the full NAV-M3
  heavyweight ticket and needs its own IA + i18n pass.
- Arrow-key navigation inside the popover. Opening moves focus
  to the first row; users can Tab through. Full roving focus
  would meaningfully complicate the Escape / outside-click
  dance for marginal UX gain at 5 items.
- Pinning / reordering of recents → **shipped as NAV-M3-lite+
  below.** The v1 slice sorted strictly chronologically; v1.1
  honours the upstream `Conversation.starred` / `isPinned` bit.
- Per-row avatars / project tags / badges. The popover is
  deliberately a single-column text menu so it stays readable
  on a 360 px viewport.
- Cross-workspace recents. The list is always scoped to the
  `conversations` slice the store already filters by
  workspace.

<a id="nav-m3-lite-plus"></a>

<a id="nav-m3-lite-plus"></a>

### NAV-M3-lite+ · Pinned conversations at the top of the recents dropdown

**Why.** NAV-M3-lite intentionally sorted the recents popover
chronologically, deferring "pin to top" to a later slice. In
practice users kept three or four threads they genuinely revisit
(an always-on kickoff, a standing 1:1, a live initiative) and
those threads fell out of the 5-row cap the moment a noisier
thread bumped them. The upstream `Conversation` model already
carries a `starred` / `isPinned` bit driven from the sidebar's
own pinning UI — the cheapest way to honour that signal is to
bubble pinned entries to the top of the breadcrumb popover, no
new data, no new input surface.

**Behaviour.**

- When the `ff.workspace_breadcrumb_recents_pinned` kill-switch
  is ON (default) and `ff.workspace_breadcrumb_recents` is ON,
  `buildRecentConversationsList` marks entries whose upstream
  `starred === true` **or** `isPinned === true` with
  `entry.pinned = true` and bubbles them above non-pinned rows.
- Within the pinned and the non-pinned sub-groups, ordering
  falls back to the NAV-M3-lite contract: newest-first by
  `lastMessageAt` with `updatedAt` fallback, ties broken by
  `id.localeCompare`. No new timestamp semantics.
- Total cap stays at `DEFAULT_MAX_RECENT_CONVERSATIONS` (5).
  Pins compete for the same slots — if a user has 5+ pinned
  threads, the popover only shows pins. That is intentional:
  those are the only threads they explicitly told us to keep
  around.
- The popover renders a small `★` glyph left of the label for
  pinned rows, exposes `data-pinned="true|false"` for
  automation, and sets `aria-label="Pinned: <full title>"` so
  screen readers announce the pin state without reading the
  glyph.
- When the pinned kill-switch is OFF, every entry carries
  `pinned=false` regardless of upstream state, the glyph never
  renders, and the popover is visually identical to
  NAV-M3-lite v1. When `ff.workspace_breadcrumb_recents` itself
  is OFF, the pinned flag is moot — the caret is hidden.

**Delivered.**

- `src/utils/workspaceBreadcrumbRecentsPinnedFlag.ts` (NEW) —
  `ff.workspace_breadcrumb_recents_pinned` kill-switch (default
  ON) with the standard URL → localStorage → env → default
  resolution order. URL alias
  `?ff_workspaceBreadcrumbRecentsPinned=0`.
- `src/utils/buildRecentConversationsList.ts` — extended input
  contract with `starred`, `isPinned`, `pinnedEnabled`; output
  entries gain a required `pinned: boolean`; sort comparator
  bubbles pinned-first. Existing v1 callers stay on the old
  shape by not passing `pinnedEnabled` (default `false`).
- `src/components/navigation/RecentConversationsDropdown.tsx` —
  each menuitem row gets a `data-pinned` attribute and
  conditionally renders an `★` span + pinned-aware
  `aria-label`.
- `src/components/navigation/WorkspaceBreadcrumb.tsx` — reads
  the new flag via the `isRecentsPinnedEnabled` test seam and
  passes `pinnedEnabled` into the recents builder.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `workspace-breadcrumb-recents-pinned` (ticket `NAV-M3.1`,
  block `navigation`, empty `telemetry`).
- Tests: 8 new `buildRecentConversationsList.test.ts` cases
  (pinned-disabled v1 shape, pinned-enabled bubbles to top,
  sub-group newest-first, `starred` ⇔ `isPinned` parity,
  defensive rejection of truthy-but-not-strictly-true, cap
  honours pins first, mixed cap preserves recents after pins,
  active-id filter still wins over pinned). 4 new
  `RecentConversationsDropdown.test.tsx` cases (`★` glyph +
  `data-pinned`, pinned `aria-label` with full title, unpinned
  row has no `aria-label`, click still fires select + close).
  3 new `WorkspaceBreadcrumb.test.tsx` cases
  (`pinnedEnabled=true` wiring, `pinnedEnabled=false` wiring,
  glyph render in the mounted popover).

**DoD.**

- [x] With the pinned kill-switch ON and at least one
      `starred`/`isPinned` sibling, the popover renders that
      row above all non-pinned rows.
- [x] Order within the pinned and non-pinned groups preserves
      the NAV-M3-lite newest-first rule.
- [x] The `★` glyph only renders on pinned rows and is hidden
      from assistive tech (the visible label is pinned-aware
      via `aria-label`).
- [x] With the kill-switch OFF, no entry carries `pinned=true`,
      the glyph never renders, and ordering matches
      NAV-M3-lite v1.
- [x] Total entry cap remains at 5. Five pinned threads
      saturate the list by design.
- [x] Zero new telemetry events; the existing
      `navigation_back_to_chat_clicked` still covers the land-
      in-chat signal.

**Deliberately out of scope.**

- Editing pin state from the breadcrumb. The sidebar is the
  only UI that can toggle `starred` / `isPinned`; the
  breadcrumb popover is strictly read-only.
- A visual separator / "Pinned" section label between groups.
  A five-row popover does not need a heading row; the `★`
  glyph is enough affordance.
- Separate caps for pinned vs recent. A single cap keeps the
  mental model simple and matches the user's intent when they
  pinned more than five threads.
- Ordering by pin-time instead of `lastMessageAt`. We do not
  have a reliable `pinnedAt` timestamp, and reusing
  `lastMessageAt` means a pinned thread the user just replied
  to bubbles above a dormant pin — which is exactly what they
  would expect.
- Exposing the pin state elsewhere (chat header, toast). Those
  surfaces already carry their own wayfinding and would need
  their own design pass.

<a id="nav-m3-lite-plus-plus"></a>

<a id="nav-m3-lite-plus-plus"></a>

### NAV-M3-lite++ · "View all" footer row in the recents dropdown

**Why.** NAV-M3-lite capped the popover at 5 rows. That is the
right default for scanability, but when a user has 20+ eligible
siblings the capped list actively hides the fact that there are
more threads to browse — the caret starts to feel *lying* rather
than helpful. The full "Cmd+K quick-switcher" is still out of
scope, but a small footer row that says "View all conversations"
and opens the existing conversations sidebar covers 90% of that
need with zero new surface area.

**Behaviour.**

- When `ff.workspace_breadcrumb_recents_view_all` is ON
  (default), `ff.workspace_breadcrumb_recents` is ON, and the
  eligible recents count (`countEligibleRecentConversations`)
  is strictly greater than the popover cap, a non-`menuitem`
  footer row renders below the last sibling with a hairline
  separator above it.
- When the eligible count fits inside the cap, the footer is
  suppressed. Pointing users at a sidebar list identical to
  what they already see is dead UX.
- Clicking the footer row:
  1. Calls `returnToFullChat()` (same verb NAV-M1 / NAV-M3-lite
     use) so the user lands on the main chat surface.
  2. If the conversations sidebar was closed, calls
     `toggleSidebar()`. If it was already open, leaves it
     alone — the helper is strictly "open-if-closed", never
     "toggle blindly".
  3. Closes the popover.
- The footer is deliberately *not* a `role="menuitem"`. It is a
  sibling control that changes the surrounding UI, not a
  navigation option inside the menu, so blending it into the
  menu's keyboard semantics would confuse screen-reader users.

**Delivered.**

- `src/utils/workspaceBreadcrumbRecentsViewAllFlag.ts` (NEW) —
  `ff.workspace_breadcrumb_recents_view_all` kill-switch
  (default ON, URL alias `?ff_workspaceBreadcrumbRecentsViewAll=0`).
- `src/utils/buildRecentConversationsList.ts` — refactored the
  per-row filter into `isEligibleRow` so both the builder and
  the new `countEligibleRecentConversations` helper agree
  bit-for-bit on what "eligible" means.
- `src/components/navigation/RecentConversationsDropdown.tsx` —
  adds optional `onViewAll` + `viewAllLabel` props. Renders a
  non-`menuitem` footer row with a hairline separator when
  `onViewAll` is provided.
- `src/components/navigation/WorkspaceBreadcrumb.tsx` — reads
  the new flag + the eligibility counter, wires
  `handleViewAll` to `returnToFullChat()` + conditional
  `toggleSidebar()`, and only passes `onViewAll` when the
  eligible count exceeds the cap.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `workspace-breadcrumb-recents-view-all` (ticket `NAV-M3.2`,
  block `navigation`, empty `telemetry`).
- Tests: 7 new `buildRecentConversationsList.test.ts` cases
  for the new counter (null / empty / filter / overflow /
  parity with builder / non-string active id / defensive
  skips). 6 new `RecentConversationsDropdown.test.tsx` cases
  (no footer without handler, default + custom label, click
  closes + fires handler, footer is not a menuitem, DOM
  order, defensive rerender). 5 new `WorkspaceBreadcrumb.
  test.tsx` cases (footer renders on overflow, suppressed on
  exact fit, suppressed on kill-switch OFF — counter skipped,
  click returns to chat + opens closed sidebar, click leaves
  open sidebar alone, popover closes on click).

**DoD.**

- [x] Footer renders only when (`ff.recents` ∧ `ff.view_all` ∧
      overflow). Otherwise hidden.
- [x] Click sequence: `returnToFullChat()` → `toggleSidebar()`
      iff sidebar was closed → popover closes.
- [x] Counter is skipped when either the recents kill-switch
      or the view-all kill-switch is OFF. Zero cost at
      steady-state for flags-off users.
- [x] Footer is not a `role="menuitem"`. Screen readers
      announce it as "View all conversations, button" — not
      as part of the menu's item list.
- [x] Zero new telemetry events. The existing
      `navigation_back_to_chat_clicked` still covers the land-
      in-chat signal.

**Deliberately out of scope.**

- Cmd+K palette / fuzzy search — still parked in the full
  NAV-M3 heavyweight ticket.
- Highlighting / scrolling the sidebar to a specific thread
  after clicking "View all". The sidebar stays at its own
  default scroll position, which is the same behaviour any
  existing sidebar-open path has today.
- Badging the footer with the overflow count (e.g. "View all
  (42)"). Feels spammy in a 5-row popover and forces us to
  promise exact counts even when the builder has to defer
  computation. A plain label keeps the contract simple.
- A keyboard shortcut that opens the popover on the footer
  row. The default focus-on-first-row pattern is unchanged;
  Tab / Shift+Tab still moves between items and the footer.

<a id="nav-m3-lite-v3"></a>

<a id="nav-m3-lite-v3"></a>

### NAV-M3-lite^3 · Recents dropdown · roving arrow-key navigation

**Status:** ✅ Shipped (2026-04-18, wave M1)

**Why now.** NAV-M3-lite v1 auto-focuses the first menuitem on open and closes on Escape; NAV-M3-lite+ added a pinned-first sort; NAV-M3-lite++ added the "View all" footer. The one remaining a11y gap was moving between rows — keyboard users had to Tab through each row to reach the one they wanted, which fights every other menu widget in the product. This pass adds the standard ARIA-menu roving-focus ring so arrows just work.

**Key contract.**

- Enabled only while the popover is open (effects/listeners attach on open, detach on close — NAV-M3-lite v1 already followed this pattern for Escape and outside-click, we keep it).
- **ArrowDown** → focus next menuitem (wraps to first after last).
- **ArrowUp** → focus previous menuitem (wraps to last after first).
- **Home** → focus first menuitem.
- **End** → focus last menuitem.
- **Tab** → close the popover and let the default Tab propagate so focus lands above the trigger. No custom Shift+Tab handling — the browser handles "back to trigger" naturally.
- **Enter / Space** → native button activation. No synthetic handler, no `preventDefault()`; the existing `onClick` path fires as if the user clicked.
- **Escape** → unchanged from NAV-M3-lite v1 (window-level listener).

**Why wrap instead of hard stop.** A 5-row popover is the common case. A hard stop at the edges means the user needs to know the list length before navigating; wrapping makes the ring feel like every other well-behaved menu in the app (sidebar quick-menus, the voice-mode legend). ARIA Authoring Practices recommends ring navigation for menus of this size.

**Why Tab closes instead of cycling.** The popover has an optional "View all" footer below the ring. Letting Tab cycle inside the ring would trap users who want to reach the footer; letting Tab *enter* the footer would fork the semantic between "ring" and "list with special last item". Closing the popover on Tab is the simplest explanation of the component's contract: the ring is the keyboard surface, the footer is Tab-order-only.

**Why the "View all" footer stays OUTSIDE the ring.** It is not a `menuitem` — it has no `role="menuitem"` and is rendered after the `<ul>` closes. The ARIA spec treats "menu > non-menuitem" as a contract violation, so keeping the footer out of the ring is not a product choice, it's spec hygiene.

**Delivered files.**

- `src/utils/workspaceBreadcrumbRecentsArrowKeysFlag.ts` — resolver + `WORKSPACE_BREADCRUMB_RECENTS_ARROW_KEYS_FLAG_KEYS` (URL ▸ localStorage ▸ env ▸ default ON).
- `src/components/navigation/RecentConversationsDropdown.tsx` — per-item `itemRefs` array, `handleItemKeyDown(event, idx)` callback, `ref` callback and `onKeyDown` wired on every menuitem. New `isArrowKeysEnabled` prop seam.
- `src/utils/chatV9FeatureFlags.ts` — registered as `workspace-breadcrumb-recents-arrow-keys` (ticket `NAV-M3.3`, block `navigation`, specDocs → this anchor).
- `src/utils/__tests__/chatV9FeatureFlags.test.ts` — added to `EXPECTED_IDS`.
- `src/components/navigation/__tests__/RecentConversationsDropdown.test.tsx` — new cases for each key + wrap behaviour + flag OFF + Tab-closes behaviour.

**DoD.**

- ✅ ArrowDown/Up wrap, Home/End jump, Enter activates via native click, Tab closes.
- ✅ Kill-switch OFF reverts to NAV-M3-lite v1 navigation pixel-for-pixel.
- ✅ Footer row remains reachable via Tab after the ring closes.
- ✅ Zero telemetry, zero new layout rules, zero pointer-event side-effects.
- ✅ `aria-haspopup="menu"` + `role="menu"` + `role="menuitem"` contract preserved.

**Deliberately out of scope.**

- **Typeahead search.** "Press `p` to focus entries starting with p" is a full menu behaviour; the recents list is usually 5 items. Adding it would pull in a debounce-and-reset ref for negligible gain in a 5-row popover.
- **Cross-popover focus.** Moving focus from the recents ring into the conversations sidebar (or vice-versa) via arrow keys is a cross-component keyboard story; it belongs in a NAV-M5 ticket if it ever becomes one.
- **Arrow-keys on the trigger itself.** ~~Parked as a future improvement~~ → shipped as NAV-M3.4 below.

---

<a id="nav-m34"></a>

## NAV-M3.4 · Recents trigger · ArrowDown shortcut

**Scope.** `?ff_workspaceBreadcrumbRecentsTriggerArrow=0|1` · `localStorage['ff.workspace_breadcrumb_recents_trigger_arrow']` · `VITE_WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW` · default **ON**.

**Rationale.** NAV-M3-lite v1 auto-focuses the first menuitem when the popover opens, and NAV-M3.3 made the menuitem ring keyboard-driveable. But keyboard users still had to *click* the trigger (or Tab to it + Enter) to get the popover open — two keystrokes when the ARIA Authoring Practices Guide for menu-buttons specifies one. This pass closes that gap: pressing `ArrowDown` while the trigger is focused opens the popover, and the existing open-effect lands focus on the first menuitem automatically. Net savings: one keystroke for every keyboard-driven recents open.

**Behaviour.**

- Trigger button gets `onKeyDown`. On `ArrowDown` *and* popover closed: `event.preventDefault()` (suppresses page scroll) + `onOpenChange(true)`.
- Trigger button gets `aria-keyshortcuts="ArrowDown"` so screen readers and keyboard-help overlays announce the shortcut declaratively. Attribute is removed entirely when the kill-switch is OFF.
- When `open === true` the handler bails early — no redundant `onOpenChange(true)` calls, no duplicate `preventDefault`. The intra-menu ring (NAV-M3.3) owns the keyboard story once the popover is open.
- Enter / Space are intentionally *not* handled — the native `<button>` activation path already fires `onClick` on both, which already opens the popover. Adding synthetic handlers would double-fire.
- ArrowUp from the trigger is **not** handled in this pass. APG suggests ArrowUp could open + focus last, but it requires a cross-effect channel ("on open, focus last not first") that doubles the test surface for marginal gain. Parked in out-of-scope until a keyboard-user study shows it matters.

**Delivered files.**

- `src/utils/workspaceBreadcrumbRecentsTriggerArrowFlag.ts` — resolver + `WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_FLAG_KEYS`.
- `src/components/navigation/RecentConversationsDropdown.tsx` — `handleTriggerKeyDown` callback, trigger `onKeyDown` + `aria-keyshortcuts` + `data-trigger-arrow` attributes, new `isTriggerArrowEnabled` prop seam, updated JSDoc.
- `src/utils/chatV9FeatureFlags.ts` — registered as `workspace-breadcrumb-recents-trigger-arrow` (ticket `NAV-M3.4`, block `navigation`, specDocs → this anchor).
- `src/utils/__tests__/chatV9FeatureFlags.test.ts` — added to `EXPECTED_IDS` directly after NAV-M3.3.
- `src/components/navigation/__tests__/RecentConversationsDropdown.test.tsx` — 9 new cases covering: `aria-keyshortcuts` present/absent, ArrowDown opens when closed and `preventDefault`s, ArrowDown is a no-op when already open, ArrowDown is a no-op when kill-switch OFF, unrelated keys (ArrowUp / Tab / Enter / Escape / letter / PageDown) do not `preventDefault` and do not open, native click still opens when kill-switch OFF, and the full keyboard path (ArrowDown → open → auto-focus first menuitem) works end-to-end through an open-state harness.

**DoD.**

- ✅ ArrowDown on the focused trigger opens the popover and focuses the first menuitem in one keystroke.
- ✅ `aria-keyshortcuts` advertises the affordance declaratively for assistive tech.
- ✅ Kill-switch OFF removes the handler and the attribute; trigger behaves like a plain button again.
- ✅ Zero new telemetry, zero new layout.
- ✅ NAV-M3.3 roving ring semantics unchanged.

**Deliberately out of scope.**

- **ArrowUp opens + focuses last.** ~~Parked — the "deferred focus target" plumbing isn't worth it for a 5-row popover.~~ → shipped as NAV-M3.5 below.
- **Typeahead on the trigger.** Same reasoning as NAV-M3.3 — typeahead in a 5-row list is over-engineering.
- **Global keyboard shortcut to focus the trigger.** Out of scope; would belong to a dedicated NAV-M5 "workspace quick-switcher" ticket.

---

<a id="nav-m35"></a>

## NAV-M3.5 · Recents trigger · ArrowUp shortcut

**Scope.** `?ff_workspaceBreadcrumbRecentsTriggerArrowUp=0|1` · `localStorage['ff.workspace_breadcrumb_recents_trigger_arrow_up']` · `VITE_WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_UP` · default **ON**.

**Rationale.** NAV-M3.4 closed the "open the recents popover in one keystroke" gap for the ArrowDown half of the APG menu-button pattern. The ArrowUp half was parked as out-of-scope on the grounds that the "deferred focus target" plumbing felt disproportionate to the win. After shipping NAV-M3.4 (and AG1 v1.10's declarative-shortcut pattern), the plumbing turned out to be a single `useRef` plus one branch in the existing auto-focus effect — not a second effect, not a second flag graph, and the test surface was the same shape as NAV-M3.4. That turned the cost/benefit calculation on its head: ArrowUp → open + focus last is now the honest completion of the APG pattern for keyboard users who want the oldest / last-pinned entry.

**Behaviour.**

- Trigger button's `onKeyDown` now handles both arrows. Closed popover + `ArrowDown` → `openFocusTargetRef.current = 'first'` then `onOpenChange(true)`. Closed popover + `ArrowUp` → `openFocusTargetRef.current = 'last'` then `onOpenChange(true)`. Both call `preventDefault()` to suppress the native page scroll.
- The auto-focus-on-open `useEffect` reads the ref and focuses either the first menuitem (same path as NAV-M3-lite v1) or the last (`itemRefs.current[entriesCount - 1]`), then resets the ref to `'first'` so the next open — whether click, ArrowDown, or programmatic — starts fresh without any leaked intent.
- `aria-keyshortcuts` on the trigger now advertises the union of NAV-M3.4 and NAV-M3.5. With both flags ON (default) it reads `"ArrowDown ArrowUp"`; with only one of the two ON it advertises only that one; with both OFF the attribute is omitted and the trigger reverts to click-only semantics (pre-NAV-M3.4 DOM).
- `data-trigger-arrow-up="true|false"` on the trigger is the stable DOM handle for screenshot / integration tests.
- When the popover is already open, both handlers bail early (same early-return rule NAV-M3.4 added). The intra-menu roving ring (NAV-M3.3) owns the keyboard story once the popover is open, so a second ArrowUp from the trigger never races the ring.
- Enter / Space remain delegated to the native `<button>` activation path — no synthetic handlers.

**Why a ref, not a state.** The marker is a one-shot signal from the keydown handler to the next run of the open-effect — no render needs to observe it. Using `useRef` keeps the open flow a single render (keydown → setOpen → render → effect reads ref → focus), whereas a `useState` signal would cost a second render to flush the marker reset. The ref is always reset inside the effect's rAF callback so the marker stays correct even if an outside-click re-close fires before the effect runs.

**Delivered files.**

- `src/utils/workspaceBreadcrumbRecentsTriggerArrowUpFlag.ts` — resolver + `WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_UP_FLAG_KEYS`.
- `src/components/navigation/RecentConversationsDropdown.tsx` — new `isTriggerArrowUpEnabled` prop seam, `openFocusTargetRef`, ArrowUp branch in `handleTriggerKeyDown`, conditional focus-last in the auto-focus-on-open effect, composed `aria-keyshortcuts` string, new `data-trigger-arrow-up` attribute, updated JSDoc.
- `src/utils/chatV9FeatureFlags.ts` — registered as `workspace-breadcrumb-recents-trigger-arrow-up` (ticket `NAV-M3.5`, block `navigation`, specDocs → this anchor).
- `src/utils/__tests__/chatV9FeatureFlags.test.ts` — added to `EXPECTED_IDS` directly after NAV-M3.4.
- `src/components/navigation/__tests__/RecentConversationsDropdown.test.tsx` — 9 new `NAV-M3.5 trigger ArrowUp` cases: composed `aria-keyshortcuts` with both flags ON, NAV-M3.4 OFF / NAV-M3.5 ON advertises only ArrowUp, both OFF omits the attribute, ArrowUp opens when closed and `preventDefault`s, ArrowUp is a no-op when already open, ArrowUp is a no-op when the kill-switch is OFF, the two flags are independent (NAV-M3.5 ON / NAV-M3.4 OFF only ArrowUp opens), open-via-ArrowUp focuses last menuitem end-to-end, open-via-ArrowDown still focuses first with both flags ON, and the marker reset (subsequent click-open falls back to first-item focus). Two pre-existing NAV-M3.4 cases (`aria-keyshortcuts` ON / OFF) were scoped with `isTriggerArrowUpEnabled={() => false}` so their assertions stay NAV-M3.4-only.

**DoD.**

- ✅ ArrowUp on the focused trigger opens the popover and focuses the last menuitem in one keystroke.
- ✅ ArrowDown continues to open + focus first (NAV-M3.4 regression).
- ✅ `aria-keyshortcuts` composes the two advertised shortcuts correctly for every on/off combination of NAV-M3.4 × NAV-M3.5.
- ✅ Kill-switch OFF removes the ArrowUp branch from the handler and drops `ArrowUp` from the advertised shortcut string — no other behaviour changes.
- ✅ Focus-target marker resets after every open so subsequent opens (click, ArrowDown, programmatic) always land on the first item unless the user asked for ArrowUp again.
- ✅ Zero new telemetry, zero new layout.

**Deliberately out of scope.**

- **Typeahead on the trigger.** Same reasoning as NAV-M3.3 — over-engineering for a 5-row list.
- **PageUp / PageDown on the trigger.** No meaningful "page" granularity on a 5-item list; the roving ring's Home/End already covers edge jumps once the popover is open.
- **Global keyboard shortcut to focus the trigger.** Same as NAV-M3.4 — belongs to the future NAV-M5 "workspace quick-switcher" ticket, not here.

## Not shipped yet

The remainder of the NAVIGATION block — IA map / help overlay
restoration, cross-module breadcrumb normalisation proper
(NAV-M2), artifact quick-switcher — is design-doc territory only
and will move here when code lands.
