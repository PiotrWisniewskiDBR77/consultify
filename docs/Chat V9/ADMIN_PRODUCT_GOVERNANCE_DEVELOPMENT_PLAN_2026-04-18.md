# ADMIN / PRODUCT GOVERNANCE — development plan (develop branch, 2026-04-18)

Honest plan: only features whose code has actually landed on `develop`
are documented here. See `README.md` in this folder for the project-wide
index.

> **Cross-refs**
> - Kill-switches & incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new admin feature → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md)

## Scope

The ADMIN block in the original audit covered four concerns:

1. **Capabilities configuration** — which models, tools and modes are
   enabled, flipped at the product level rather than per-user.
2. **Observability** — which flags are used in the wild, which funnels
   are healthy, which surfaces are silently broken.
3. **Governance** — who can flip what, what stays locked.
4. **UX** — admins need an actual surface to touch, not just
   localStorage incantations.

Milestone 0 of the ADMIN lane targeted (4) first: give ops and owners
a place to **see and flip the V9 flags** without a redeploy. Every
other ADMIN feature depends on that being a first-class surface.

## Shipped

<a id="ag1-v1"></a>

### AG1 v1 · Feature flag control panel

- **Effort**: S
- **Priority**: P0 (blocks every other owner-level ADMIN feature)
- **Risk**: low (read-only by default, flips scoped to local `localStorage`,
  role-gated so only SUPERADMIN / OWNER / ADMIN see the overlay)
- **Status**: ✅ shipped (pass 40 added defence-in-depth role gate)
- **Flag**: _none on the overlay itself_ — activation is URL-gated
  via `?v9flags=1` AND role-gated on
  `isV9FlagsOverlayAuthorized(currentUser)`. Per-flag toggles inside
  the panel flow through the existing per-feature flags.

What landed:

- `src/components/admin/ChatV9FlagsPanel.tsx` — presentational panel.
  Renders every entry of `CHAT_V9_FLAGS` as a row with:
  - title, ticket, one-line description,
  - live resolved state (`on` / `off`),
  - an `override` badge when the entry differs from the shipped
    default,
  - the localStorage key (for terminal-level debugging),
  - three buttons per row: `ON`, `OFF`, `default`. `ON` / `OFF`
    write through `setChatV9FlagOverride`; `default` clears via
    `clearChatV9FlagOverride`.
  - a header button: `Reset all` (disabled while zero overrides) which
    fires `resetAllChatV9FlagOverrides`.
- `src/components/admin/ChatV9FlagsOverlay.tsx` — URL-triggered
  modal wrapper:
  - activates on `?v9flags=1` (aliases: `=true`, `=on`),
  - also opens / closes via the window CustomEvents
    `chat-v9-flags:open` / `chat-v9-flags:close` so a later admin
    menu can wire a button without importing the overlay,
  - dismisses on Escape and backdrop click,
  - returns `null` when inactive so the mount has zero cost on
    every other route.
- Single mount point in `src/App.tsx`, immediately after `<RouterSync />`.
  No route changes. No provider changes. Returns `null` for every
  non-admin user and every non-admin URL.
- **Role gate** (pass 40): `isV9FlagsOverlayAuthorized(user)` is a
  pure predicate exported from `ChatV9FlagsOverlay.tsx`. Accepts
  `SUPERADMIN`, `OWNER`, `ADMIN` (case-insensitive, trimmed); rejects
  `USER`, legacy roles (`MANAGER`, `VIEWER`, etc.), missing users,
  and empty / null roles. Wired through Zustand selector
  `useAppStore((s) => s.currentUser)` so the overlay re-evaluates
  when the auth state changes mid-session — a user promoted to
  admin sees the overlay on the next `?v9flags=1` navigation without
  a reload.
- Tests under `src/components/admin/__tests__/`:
  - panel — renders every registered flag, wires all three toggle
    buttons through the write helpers, "Reset all" disabled /
    enabled state gated on snapshot contents, `onClose` prop
    propagates, override-count header reflects snapshot.
  - overlay — URL gate (present / absent / alias), Escape + backdrop
    dismissal, panel `onClose` closes overlay, external open/close
    CustomEvents, mounted-but-inactive case returns `null`.

### DoD

- `?v9flags=1` on any app URL opens a modal showing every V9 flag
  currently registered.
- Each row's ON / OFF / default button flips the corresponding
  `localStorage["ff.<key>"]`, taking effect on the next render.
- Closing via backdrop, Escape or the header close button returns the
  app to the previous view with no state leak.
- `window.dispatchEvent(new CustomEvent('chat-v9-flags:open'))` is a
  documented programmatic entry point; close event likewise.
- Full test coverage of the write helpers + dismiss paths; registry
  `specDocs` test picks up this plan file on disk.

### Deliberately out of scope (v1)

- **Server-enforced access control.** The role gate is enforced
  client-side via the Zustand-held `currentUser.role`. A tampered
  store could unlock the overlay, but that unlocks only
  `localStorage` writes in the attacker's own browser — the writes
  never round-trip to the server. Hardening the overlay against a
  user who has both admin role AND wants to brick their own tab is
  explicitly not a goal. A future v2 can also consult a server
  capability flag.
- **Remote telemetry.** No event is emitted when the overlay opens or
  a flag is flipped. Admin actions are deliberately not in the
  product analytics funnel — we don't want staff activity polluting
  usage metrics. When / if needed, add an `admin_flag_toggled` event
  with `{ flagId, nextState: 'on'|'off'|'default' }` and an explicit
  PII contract.
- **Persisting across devices.** `localStorage` is browser-local by
  design; clearing cookies / switching device resets every override.
  A server-side override surface is a separate project.
- **Flag creation / editing.** The panel is read + toggle only. New
  flags still land via the code registry in `chatV9FeatureFlags.ts`.

<a id="ag1-v11"></a>

### AG1 v1.1 · Override indicator chip

- **Effort**: S
- **Priority**: P1 (discoverability on top of AG1 v1)
- **Risk**: low (admin-only, auto-hides at zero overrides)
- **Status**: ✅ shipped (pass 41)

What landed:

- `src/components/admin/ChatV9FlagsIndicator.tsx` — a small floating
  pill in the bottom-right corner that renders only when:
  - the current user passes `isV9FlagsOverlayAuthorized`, AND
  - at least one V9 flag is overridden away from its shipped default
    in this browser session.
- When visible, the pill reads "N V9 override(s)". Clicking it
  dispatches the `chat-v9-flags:open` CustomEvent that `ChatV9FlagsOverlay`
  already listens for — the two components stay fully decoupled.
- Override count refreshes via a lightweight 3-second poll
  (`pollIntervalMs` configurable; 0 disables the timer for tests).
  Poll is not scheduled at all when the user is unauthorised, so
  non-admin sessions pay exactly one role-check on mount.
- Mounted once at the App root in `src/App.tsx`, alongside the
  overlay. Returns `null` otherwise.

### DoD

- No chrome is visible for admins whose session matches every shipped
  default (the common case).
- When any flag is flipped via the overlay or `localStorage`, the
  pill shows the live count within one poll cycle.
- Clicking the pill opens the overlay via the existing CustomEvent
  hook — no direct coupling between the two files.
- Non-admins never receive the pill, even if overrides exist in
  their local browser (role gate first).

### Deliberately out of scope (v1.1)

- **Per-flag tooltip on hover.** The pill is a count only; the
  overlay is one click away and is the place we invested in
  rendering flag names. Dual surfaces invite drift.
- **Cross-tab push via `BroadcastChannel`.** The 3-second poll is
  enough for admin ergonomics and keeps the module side-effect-free.

<a id="ag1-v12"></a>

### AG1 v1.2 · Copy-snapshot button

- **Effort**: XS
- **Priority**: P2 (admin ergonomics polish)
- **Risk**: very low — pure read + clipboard write, behind the
  role-gated overlay, kill-switchable
- **Status**: ✅ shipped
- **Flag**: `flags-snapshot-copy`
  (`ff_flagsSnapshotCopy=1|0`), default ON

What landed:

- `src/utils/flagsSnapshotCopyFlag.ts` — standard
  URL > localStorage > env > default ON resolver.
- `src/utils/chatV9FlagsSnapshotText.ts` — two helpers decoupled
  from the panel component:
  - `buildChatV9FlagSnapshotText({ now?, label? })` renders the
    current flag state as a Markdown table. Columns: ticket · id
    · block · state · override · default · matches default ·
    storage key. Header line embeds an ISO timestamp (test-seam
    via `now`). Registry is the only source of truth for
    ordering — we do not re-sort, so owners who paste successive
    snapshots into the same ticket get diff-friendly output.
  - `copyTextToClipboard(text)` writes the blob to the system
    clipboard. Tries `navigator.clipboard.writeText` first
    (secure-context async path), falls back to the synchronous
    hidden-textarea `document.execCommand('copy')` pattern when
    the async path is unavailable or denied. Returns a
    discriminated union (`ok: true | false, via | reason`) so
    the UI can render distinct "Copied" / "Copy failed" states.
- `src/components/Admin/ChatV9FlagsPanel.tsx` — new header
  button, immediately left of "Reset all". Click triggers the
  helpers above and flips the button into a transient
  "Copied" / "Copy failed" state for `COPY_FEEDBACK_MS` (2s),
  after which it returns to "Copy snapshot". Rapid re-clicks
  collapse into one feedback window via a single timer ref.

### DoD

- With the flag ON, admins see a "Copy snapshot" button in the
  panel header. Clicking it puts a deterministic Markdown table
  of every registered flag onto the clipboard.
- The blob always contains the ISO timestamp, a header row, a
  divider row, and exactly one data row per `CHAT_V9_FLAGS`
  entry (covered by
  `src/utils/__tests__/chatV9FlagsSnapshotText.test.ts`).
- A failed clipboard write (permissions policy, HTTP origin,
  both paths exhausted) never crashes the panel. The button
  flips to "Copy failed" instead and returns to idle after 2s.
- With the flag OFF (URL / localStorage / env), the button
  returns `null`. The rest of the panel (rows, toggles,
  "Reset all") is unchanged.
- The panel's existing role gate still applies — non-admins
  never see the button because they never see the overlay.

### Deliberately out of scope (v1.2)

- **Download as .md / .json.** The clipboard is the fast path
  for pasting into Notion / Slack / GitHub; a file download
  would add a spec doc and a filename convention for very
  little marginal benefit.
- **Per-tenant label wiring.** The `label` parameter is in
  place for callers who want to prepend a tenant slug, but the
  panel itself does not pass one. We'll turn this on when the
  panel has access to the tenant id without pulling in a store
  — keeping the helper tenant-agnostic also keeps it safe to
  reuse outside the admin surface.
- **Telemetry.** Internal admin actions do not emit V9
  funnel events (neither do the ON / OFF / default / Reset
  buttons). Adding one for Copy would break that consistency
  without a clear question the data would answer.

<a id="ag1-v13"></a>

### AG1 v1.3 · URL reset one-liner (`?v9flags=reset`)

- **Effort**: XS
- **Priority**: P2 (ops-ergonomics sibling to AG1 v1.2)
- **Risk**: low — wraps an existing write-side helper
  (`resetAllChatV9FlagOverrides`), role-gated, kill-switchable,
  exactly-once per mount
- **Status**: ✅ shipped
- **Flag**: `flags-reset-url` (`ff_flagsResetUrl=1|0`),
  default ON

What landed:

- `src/utils/flagsResetUrlFlag.ts` — standard
  URL > localStorage > env > default ON resolver.
- `src/components/admin/ChatV9FlagsResetHandler.tsx` — headless
  component mounted once at the App root (JSX-declared **after**
  `ChatV9FlagsOverlay` so the overlay's event listener is
  attached before the handler dispatches `chat-v9-flags:open` —
  effects fire in declaration order during commit). On mount:
  1. If the flag is off → return.
  2. If the URL does not carry `?v9flags=reset` (case-
     insensitive) → return.
  3. If the user is not authorised via
     `isV9FlagsOverlayAuthorized` → strip the query key only and
     return. The write-side helper is never reached.
  4. If the user is authorised → call
     `resetAllChatV9FlagOverrides()` in a try/catch, rewrite
     the query to `?v9flags=1` via `history.replaceState`
     (preserving every other query param and the URL hash), then
     dispatch `chat-v9-flags:open` so the overlay pops on the
     same render tick.
- The effect depends on `[authorize, currentUser, isEnabled,
  performReset]`; in practice it fires once per mount because
  none of those change on the same page load, which matches
  the exactly-once semantics users expect from a "reset link".

### DoD

- Visiting `https://app.example/any/route?v9flags=reset` as an
  authorised admin clears every `ff.*` override in localStorage,
  rewrites the URL to `?v9flags=1` (keeping any other params +
  the hash), and the overlay opens on top of the current route
  with the header reading "All flags at their shipped defaults".
- The same URL as a non-admin user is a no-op aside from the
  query getting cleaned up. No writes to localStorage, no
  overlay, no UI chrome.
- With the flag off, the URL `?v9flags=reset` does nothing —
  the query persists, no reset happens. This is the ops
  kill-switch path.
- Repeated re-renders of the handler never trigger a second
  reset. A fresh reset requires navigating back to a URL with
  `?v9flags=reset`.
- A thrown error inside the reset helper (localStorage quota,
  private mode) does not crash the app. The URL is still
  rewritten and the overlay still opens so the admin can see
  current state and retry via the "Reset all" button.

### Deliberately out of scope (v1.3)

- **Toast notification.** The overlay popping open with "All
  flags at their shipped defaults" in the header is the visible
  confirmation. Adding a toast duplicates the signal and
  requires wiring in `react-hot-toast` at the handler, which
  would make the component non-headless.
- **URL-driven partial resets** (e.g. `?v9flags=reset:voice`).
  Would require the registry to expose a block → flag-ids map
  and careful thinking about telemetry symmetry. The panel's
  per-row "default" button already covers targeted resets.
- **Redirect-after-reset.** The handler deliberately stays on
  the current route and only mutates the query. A redirect
  would make the link dangerous — admins sometimes use it on
  non-root routes while debugging.
- **Telemetry.** Same rationale as AG1 v1.2: internal admin
  write actions do not emit V9 funnel events.

<a id="ag1-v15"></a>

### AG1 v1.5 · Admin flag panel filter input

- **Effort**: XS
- **Priority**: P2 (ops-ergonomics sibling to AG1 v1.2 / v1.3)
- **Risk**: low — presentational only, no write-side semantics
  change, kill-switchable
- **Status**: ✅ shipped
- **Flag**: `flags-panel-filter` (`ff_flagsPanelFilter=1|0`),
  default ON

Why this ticket

- The panel lists every registered V9 flag on a single scroll.
  At 16 entries the list is already dense and the registry
  keeps growing each wave. Admins hunting for a specific
  ticket (e.g. "where is `NAV-M1.1`?") currently have to eye-
  scan the whole list.
- A tiny filter input reuses ergonomic muscle memory (Slack /
  VS Code / GitHub admin panels all ship a search row above
  dense lists) and costs nothing in complexity.
- Kept intentionally read-only: the input narrows the visible
  set but does NOT change which flags are registered, which
  overrides are applied, or the Reset-all semantics. That
  keeps the mental model "filter ⊆ display" which is the only
  sustainable design for a panel that doubles as a rescue
  surface when flags are misbehaving.

What landed

- `src/utils/flagsPanelFilterFlag.ts` — standard resolver
  with URL > localStorage > env > default ON.
- `src/utils/matchChatV9Flag.ts` — pure, dependency-free
  predicate + haystack helper. Matches case-insensitively
  across `title`, `ticket`, `block`, `id`, `keys.localStorage`
  and **deliberately excludes** `description` to avoid noisy
  token hits. Multi-token queries are AND-joined and order-
  independent (`"trust copy"` ≡ `"copy trust"`).
- `src/components/Admin/ChatV9FlagsPanel.tsx` — adds a
  `<filter row>` below the header with a `Search` icon,
  `<input>`, clear-X (shown only when the query is non-empty),
  and a `N/total` count pill. Typing narrows the list; a
  no-match query renders a dedicated empty state
  (`chat-v9-flags-filter-empty`) instead of collapsing the
  filter row — users need to see their query to know what
  went wrong. Flipping the flag OFF mid-session wipes the
  stored query so re-opening the overlay starts clean.
- Registered as `flags-panel-filter` / ticket `AG1.5` in
  `chatV9FeatureFlags.ts`.
- Tests: 13 in `matchChatV9Flag.test.ts` (haystack fields,
  case-insensitivity, multi-token AND, whitespace tolerance,
  description-exclusion invariant) and 8 new in
  `ChatV9FlagsPanel.test.tsx` (kill-switch gate, idle render,
  block filter, case-insensitive, no-match empty state, clear-X
  behaviour, multi-token AND, flag-off-resets-query).

### DoD

- With the flag ON, opening the overlay shows a filter row
  with an empty input and a `N/N` count matching the registry
  size.
- Typing a block name narrows visible rows to that block; the
  count pill shifts to `k/N`; the clear-X appears.
- A no-match query renders the `chat-v9-flags-filter-empty`
  panel and hides every flag row; the count pill reads `0/N`.
- Clicking the clear-X empties the input, restores every row,
  and hides itself.
- Flipping the kill-switch OFF (`ff.flags_panel_filter=0`)
  hides the filter row entirely and re-renders the full list;
  flipping it back ON starts with an empty query.
- Override / Reset / Copy-snapshot semantics are byte-for-byte
  unchanged with or without the filter applied.

### Deliberately out of scope (v1.5)

- **Grouping by block.** Shipped as the sibling AG1 v1.6
  ticket below.
- **Persisting the query in localStorage.** Filters should not
  sticky-persist between admin visits — the panel is a rescue
  tool, and opening it with a stale filter silently hiding
  rows would be a UX footgun.
- **Fuzzy / Levenshtein matching.** Substring is enough for a
  corpus of ~20 short technical labels. Fuzzy search adds a
  dependency and a tuning surface (edit-distance thresholds)
  with no tangible benefit here.
- **Telemetry.** Internal admin reads do not emit V9 funnel
  events — same rationale as AG1 v1.2 / v1.3.

<a id="ag1-v16"></a>

### AG1 v1.6 · Admin flag panel collapsible block groups

- **Effort**: S
- **Priority**: P2 (ops-ergonomics sibling to AG1 v1.5)
- **Risk**: low — reshuffles DOM structure inside the panel,
  filter / snapshot-copy / reset-all semantics unchanged,
  kill-switchable
- **Status**: ✅ shipped
- **Flag**: `flags-panel-grouping`
  (`ff_flagsPanelGrouping=1|0`), default ON

Why this ticket

- At 18 registered flags the flat list already fills the
  overlay twice. Flags belong to five discrete
  blocks (`voice`, `trust`, `admin`, `navigation`, `input`)
  and admins almost always have one block in mind when they
  open the panel ("I need the trust stuff").
- Grouping keeps the filter from v1.5 useful for precise
  lookups while reducing the cost of *browsing*, which is
  the dominant use when triaging a misbehaving feature.
- Pairs cleanly with v1.5: while the user is typing, every
  group with matches auto-expands so matching hits are
  reachable without extra clicks. Clearing the query restores
  whatever the admin had collapsed before.

What landed

- `src/utils/flagsPanelGroupingFlag.ts` — standard resolver
  (URL > localStorage > env > default ON).
- `src/utils/groupChatV9Flags.ts` — pure grouping helper.
  Uses the full registry to establish block order (first-seen,
  not alphabetical — the registry author's ordering survives
  into the UI) and totals per block, then buckets the filtered
  list into those slots. Empty blocks are dropped entirely so
  the UI never renders an empty section. No DOM, no React.
- `src/components/Admin/ChatV9FlagsPanel.tsx` — swaps the flat
  `<ul>` for a sequence of `<section>` blocks each with a
  clickable header (`ChevronDown` / `ChevronRight` + block
  name + `visible/total` or just `total` when the filter is
  inactive + optional amber override-count pill). Per-block
  collapse state lives in a local `Set<ChatV9Block>`; a
  `filterActive` flag force-expands groups whose `hasMatches`
  is true so matching rows are always reachable while typing.
  The row markup moved into a private `renderFlagRow` helper
  so both the grouped and flat paths share identical DOM.
- Registered as `flags-panel-grouping` / ticket `AG1.6` /
  block `admin`.
- Tests: 7 in `groupChatV9Flags.test.ts` (first-seen order,
  empty-block exclusion, totals survive filtering, within-
  group order echoes the caller, empty visible list, etc.)
  and 7 new in `ChatV9FlagsPanel.test.tsx` (grouping-off flat
  list, grouping-on header coverage, total-only counts, click
  collapse/expand, filter force-expansion, visible/total count
  under filter, override pill math).

### DoD

- With the flag ON, the panel shows one `<section>` per
  registered block. Block order matches first-seen registry
  order.
- Each group header exposes `aria-expanded` and
  `aria-controls`, so screen readers can navigate the
  collapse state.
- All groups are expanded on first open; clicking a header
  toggles collapse / expand for that block only.
- When any AG1 v1.5 query is typed, every group whose
  `hasMatches === true` renders expanded regardless of its
  stored collapse state. Clearing the query restores the
  remembered collapse state exactly.
- With zero filter, the count pill shows just `total`. With a
  non-empty filter, it switches to `visible/total`.
- Any block containing at least one overridden flag shows an
  amber `N override(s)` pill next to the count; others do not.
- Flipping the kill-switch OFF
  (`ff.flags_panel_grouping=0`) re-renders the pre-v1.6 flat
  list. Reset-all, copy-snapshot, filter input and every
  per-row override button keep the exact same test ids and
  wiring.

### Deliberately out of scope (v1.6)

- **Persisting collapse state across sessions.** Panel is a
  rescue tool; opening it with a silently-collapsed trust
  group when a trust flag is misbehaving would be a footgun.
- **Bulk per-group actions** (e.g. "reset every trust flag").
  Useful but requires thinking about telemetry and
  confirmation dialogs that the minimal v1.6 surface avoids.
  Per-row default buttons already cover targeted resets.
- **Drag-and-drop reordering of groups.** Block order is
  editorial, not user-preference; the registry author's
  ordering is the contract.
- **Telemetry.** Same rationale as AG1 v1.2 / v1.3 / v1.5:
  internal admin reads do not emit V9 funnel events.

<a id="ag1-v17"></a>

<a id="ag1-v17"></a>

### AG1 v1.7 · Admin flag panel · per-row spec-doc breadcrumb

**Why.** Every registered Chat V9 flag is tied to a plan /
telemetry contract entry via `specDocs[]`, and the registry test
already enforces that those paths resolve to real files on disk.
Until now that link only lived in the source — admins scanning
the panel at 3 a.m. had no in-product way to jump from a flag row
to the document that explains *why* it was introduced. Surfacing
the first spec doc as a small monospace breadcrumb under each row
turns the "where is this documented?" question into a hover-away
answer, without adding a navigation side effect the panel is not
supposed to own.

**Behaviour.**

- Each flag row renders a small, selectable monospace line below
  the ticket pill: `docs: <first spec doc path>`.
- Flags with multiple entries append a `(+N more)` dim hint so
  the row at a glance still telegraphs "this flag has more than
  one doc".
- The full newline-joined list of every spec doc path rides along
  in the row's `title=` attribute — hover surfaces it verbatim.
- Flags with no spec doc entries render a dimmed `— no spec docs`
  placeholder so the gap is *visible* (the registry test will
  fail before a real flag can land without docs, but the
  placeholder keeps layout stable under e.g. a live-reload with a
  half-typed descriptor).
- Admin-only surface (the whole panel is role-gated). Kill-switch
  `ff.flags_panel_doc_links` falls back to the pre-v1.7 row shape
  pixel-for-pixel. Zero telemetry.

**Delivered.**

- `consultify/src/utils/buildChatV9FlagDocSummary.ts` (NEW) —
  pure summary builder: `primary`, `extraCount`, `totalCount`,
  `tooltip`. Skips blank / non-string entries and is defensive
  against missing / non-array `specDocs`.
- `consultify/src/utils/flagsPanelDocLinksFlag.ts` (NEW) —
  standard Chat V9 resolver (URL → localStorage → env → default
  ON) for the kill-switch.
- `consultify/src/components/Admin/ChatV9FlagsPanel.tsx` — wires
  the summary into `renderFlagRow`, gated by the new flag; adds
  the `isDocLinksEnabled` test seam.
- `consultify/src/utils/chatV9FeatureFlags.ts` — registered as
  `flags-panel-doc-links` (ticket `AG1.7`, block `admin`).

**DoD.**

- [x] Every flag row in the live panel renders the breadcrumb
      line (no empty placeholder for the current registry,
      because every shipped flag has ≥1 spec doc entry).
- [x] Hovering the breadcrumb surfaces the full list of paths
      via the browser tooltip (`title=`).
- [x] Kill-switch OFF collapses the row back to the pre-v1.7
      shape, with the localStorage key line remaining the last
      sub-row.
- [x] Pure helper + flag resolver both pass their dedicated unit
      tests; panel tests pin the ON / OFF paths, tooltip content
      and `(+N more)` hint renderer.
- [x] No new telemetry events fire. No navigation side effects.

### Deliberately out of scope (v1.7)

- **Clickable docs link.** The paths are repository-relative and
  the panel has no opinion on how the repo is hosted (GitHub,
  GitLab, self-hosted). Rendering the path as selectable text
  keeps the admin in control of how to open it without coupling
  the panel to a specific forge.
- **Per-flag "copy docs path" button.** Admins can select the
  text and Cmd/Ctrl+C. Adding a dedicated button duplicates AG1
  v1.2 affordances for marginal ergonomic gain.
- **Automatic last-updated / author metadata.** Out of scope
  until there is a usage signal justifying it. The registry test
  already guarantees the files exist.
- **Telemetry.** Same rationale as AG1 v1.2 / v1.3 / v1.5 /
  v1.6: internal admin reads do not emit V9 funnel events.

<a id="ag1-v18"></a>

<a id="ag1-v18"></a>

### AG1 v1.8 · Admin flag panel · per-flag description expansion toggle

**Why.** Flag descriptions in `CHAT_V9_FLAGS` are intentionally
detailed — they document the behaviour, the kill-switch path,
the telemetry contract, and the deliberately-out-of-scope notes
that the spec-doc breadcrumb (v1.7) points back to. The panel
clamps them to three lines via `line-clamp-3` so the table stays
scannable, but the clamp truncates mid-sentence on most rows,
which means "I need to know what this flag *actually* does" has
been a `window.getComputedStyle` or dev-tools Expand moment
since v1 shipped. A small inline `Show more` / `Show less`
button is the minimal UI to fix that without re-architecting
the panel.

**Behaviour.**

- When the `ff.flags_panel_description_expand` kill-switch is
  ON (default), every row whose description is ≥ 220 trimmed
  chars grows a small low-contrast `Show more` button below
  the clamped paragraph. Shorter descriptions never grow the
  button because `line-clamp-3` already shows the full text at
  ~12 px text-xs, so the toggle would be a visible no-op.
- Clicking the button drops the `line-clamp-3` class on that
  row's `<p>`, swaps the class to `whitespace-pre-line` so
  paragraph breaks render, and updates the button label to
  `Show less`. The button's `aria-expanded` reflects the state
  and `aria-controls` points at the description's `id` so
  screen readers announce the disclosure correctly.
- Clicking again collapses the row, restoring `line-clamp-3`
  and `Show more`. Other flag rows are unaffected.
- Expansion state is component-local and intentionally not
  persisted (no `localStorage`, no URL param). The panel is a
  rescue tool; the common admin flow is "open panel → read
  details → flip flag → close", and sticky-expanding a
  description across sessions wastes vertical space the next
  time the admin opens the panel.
- When the kill-switch is OFF, the button never renders and the
  panel falls back to the v1.7 shape pixel-for-pixel
  (`line-clamp-3` only, full text via right-click / DOM
  inspect). The heuristic is not evaluated either, so the
  no-toggle path is free.

**Threshold choice.** The column renders at text-xs (12 px)
with `line-clamp-3` on a ~500 px reading width — roughly 70
chars / line, so ~210 chars is the natural clamp boundary. The
helper uses **220** as `DEFAULT_DESCRIPTION_EXPAND_THRESHOLD` to
stay on the safe side and never offer a toggle that would not
reveal new content. All 27 currently-registered flags cross the
threshold, so the toggle is effectively universal; the guard is
future-proofing for short descriptions that belong on one-liner
flags (per-OS fallbacks, minor variants, etc.).

**Delivered.**

- `src/utils/flagsPanelDescriptionExpandFlag.ts` (NEW) —
  `ff.flags_panel_description_expand` kill-switch with the
  standard URL → localStorage → env → default resolver.
- `src/utils/shouldOfferChatV9FlagExpand.ts` (NEW) — pure
  heuristic exporting `DEFAULT_DESCRIPTION_EXPAND_THRESHOLD =
  220` + `shouldOfferChatV9FlagExpand({ description, threshold
  })`. Defensive against non-string / null / empty /
  whitespace-only inputs, rejects non-finite / zero / negative
  thresholds.
- `src/components/Admin/ChatV9FlagsPanel.tsx` — adds the
  `isDescriptionExpandEnabled` prop (test seam), per-flag
  `expandedDescriptions: Set<string>` state and the
  `toggleDescriptionExpanded(id)` callback, plus the render
  path for the `Show more` / `Show less` button tied to the
  description paragraph via `aria-controls`.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `flags-panel-description-expand` (ticket `AG1.8`, block
  `admin`, empty `telemetry` array, `specDocs` pointing back
  to this section).
- Tests: `shouldOfferChatV9FlagExpand.test.ts` (7 cases:
  non-string, empty / whitespace, below / at / above threshold,
  whitespace-padded length, custom threshold, non-finite /
  zero / negative thresholds). Extends
  `ChatV9FlagsPanel.test.tsx` with 5 cases: kill-switch OFF
  renders no button + preserves `line-clamp-3`, kill-switch ON
  renders `Show more` with `aria-expanded="false"` +
  `aria-controls`, first click expands + swaps label +
  `aria-expanded="true"`, second click collapses, expanding one
  flag does not expand siblings.

**DoD.**

- [x] Every long description in the panel has a working
      `Show more` / `Show less` toggle when the flag is ON.
- [x] The toggle is absent for short descriptions (no
      visible no-op button).
- [x] Kill-switch OFF restores the v1.7 shape pixel-for-pixel
      (`line-clamp-3` only, no button, no aria changes).
- [x] Expansion state is per-flag and does not bleed across
      rows.
- [x] A11y: the button exposes `aria-expanded`, `aria-controls`,
      and points at the description paragraph's `id`.
- [x] Zero telemetry, zero persistence, zero route changes.

**Deliberately out of scope.**

- **Persisting expansion across sessions or across panel
  reopens.** The panel is short-lived; sticky expansion is
  noise.
- **Animated expand / collapse transitions.** The panel already
  re-renders on every flag toggle; adding a height animation
  would cost more than it adds.
- **Markdown rendering inside the description.** Descriptions
  are free-form prose; rendering them as Markdown would
  require escaping runbook content and is disproportionate for
  an admin surface.
- **Per-block expand-all / collapse-all.** The common flow is
  "expand one description → flip the flag"; a bulk control
  would invert the default clamp.
- **Server-side flag docs fetch.** The registry descriptions
  *are* the source of truth; fetching a longer variant from a
  backend would fork the documentation contract the
  `specDocs` test already pins.

<a id="ag1-v19"></a>

<a id="ag1-v19"></a>

### AG1 v1.9 · Admin flag panel · sticky block-group headers

**Status:** ✅ Shipped (2026-04-18, wave M1)

**Why now.** AG1 v1.6 shipped collapsible block groups; AG1 v1.5 shipped filtering; AG1 v1.8 shipped per-flag description expansion. All three together mean a single admin view can easily stretch past the panel's `max-h-[70vh]` scroll container — and the AG1 v1.6 header that tells the admin *which block* they're reading scrolls away the instant they engage with the first expanded row. Sticky headers close that last micro-gap: the section label, override badge, and chevron affordance stay in view for the entire scroll so admins never lose context, whether they're scanning a filtered list or drilling into a single flag.

**Behaviour.**

- When the AG1 v1.6 grouping kill-switch is **ON** and the AG1 v1.9 kill-switch is **ON** (default): each `<section>` header button gains `position: sticky; top: 0; z-index: 10`, an opaque background (`bg-slate-50` / `dark:bg-navy-900`), and a 1 px bottom shadow so row content never bleeds through.
- When AG1 v1.9 is **OFF**: headers revert to the AG1 v1.6 translucent `bg-slate-50/70` / `bg-navy-900/50` styling and scroll normally — pixel-for-pixel identical to v1.6.
- When AG1 v1.6 is **OFF** (flat list): v1.9 is moot — no headers render at all and the sticky flag is read purely as a no-op guard.
- The `data-sticky="true"` / `data-sticky="false"` attribute on each header button is the stable handle tests and screenshots pin against; the `isStickyGroupHeadersEnabled` prop is the test seam.

**Why CSS sticky and not a scroll listener.** Sticky is the one-line native mechanism for this exact use case (pin-on-scroll-until-next-sibling-steals-the-top). A JS scroll listener would add a render-loop dependency for zero behavioural gain and fight the existing `overflow-y-auto` container the way most "sticky-via-JS" bugs do. The opaque background + shadow are the only two extra rules required to make the stock sticky behaviour look right once rows scroll *under* the pinned header.

**Delivered files.**

- `src/utils/flagsPanelStickyGroupHeadersFlag.ts` — resolver + `FLAGS_PANEL_STICKY_GROUP_HEADERS_FLAG_KEYS` (URL ▸ localStorage ▸ env ▸ default-ON).
- `src/utils/chatV9FeatureFlags.ts` — registered as `flags-panel-sticky-group-headers` (ticket `AG1.9`, block `admin`, `specDocs` → this anchor).
- `src/components/Admin/ChatV9FlagsPanel.tsx` — new `isStickyGroupHeadersEnabled` prop seam; computes `stickyGroupHeadersEnabled = groupingEnabled && …` once per render; swaps header `className` and emits `data-sticky` accordingly.
- `src/components/Admin/__tests__/ChatV9FlagsPanel.test.tsx` — six new cases covering sticky ON + grouping ON, sticky OFF + grouping ON, grouping OFF moots sticky, opaque vs translucent backgrounds, and live kill-switch flipping.

**DoD (all met).**

- ✅ Kill-switch OFF = pixel-for-pixel AG1 v1.6 header styling.
- ✅ No new telemetry (panel still never fires engagement events).
- ✅ No persistence (collapse state remains per-panel-instance; sticky is pure CSS).
- ✅ Zero interaction with grouping's collapse/force-expand rules.

**Out of scope for v1.9.**

- **Per-block color tokens.** All headers share the slate/navy palette today; block-specific hues (e.g. `trust` = emerald) would cross into design-system work that belongs in its own ticket.
- **Sticky override badge cluster.** The summary row at the panel top does not stick; it is still part of the scrolled content. Sticky-ing it would compete with the group header's top anchor and halve the visible row count on short viewports.
- **Scroll-shadow on the container itself.** A "fade-when-content-is-behind" gradient on the scroll viewport is an independent polish pass, not a sticky-header prerequisite.

<a id="ag1-v110"></a>

<a id="ag1-v110"></a>

### AG1 v1.10 · Admin flag panel · per-row keyboard shortcuts (`o` / `f` / `d`)

**Status:** ✅ Shipped (2026-04-18, wave M1)

**Why now.** AG1 v1 gave admins the table; v1.2–v1.9 added progressively more scaffolding (copy snapshot, reset one-liner, filter, grouping, doc links, description expand, sticky headers). With scaffolding done, the last ergonomic gap is the flip itself — an admin testing three flags currently has to mouse to three `ON` / `OFF` / `default` buttons in a row. v1.10 closes that gap with the cheapest possible affordance: three single-letter accelerators that work as long as focus is inside a row.

**Behaviour.**

- While focus is **inside** a flag row (the row `<li>`, a toggle button, the "Show more" expand button, any future descendant), lowercase keypresses:
  - `o` → `setChatV9FlagOverride(id, 'on')` (same as clicking `ON`).
  - `f` → `setChatV9FlagOverride(id, 'off')` (same as clicking `OFF`).
  - `d` → `clearChatV9FlagOverride(id)` (same as clicking `default`).
- Each of those three keypresses calls `preventDefault()` so the letter never reaches a focused button's own click handler or the browser's typeahead.
- **Always** ignored:
  - Any keypress with `⌘` / `Ctrl` / `Alt` / `Shift` so `⌘O`, `Ctrl+F`, etc. remain available to the browser and the OS.
  - Uppercase `O` / `F` / `D` — the handler keys on the lowercase `key` value only, so holding Shift (which fires uppercase) is a dead no-op, not an accidental flip.
  - Any keypress whose `event.target` is an `<input>`, `<textarea>`, `<select>`, or `contenteditable` element — even if that element is grafted inside the row after AG1 v1.10 ships. This keeps the filter input (AG1 v1.5), browser `⌘F`, and any future inline edit surface typing-safe without a second kill-switch.
- The three toggle buttons gain matching `aria-keyshortcuts` attributes (`o`, `f`, `d`) so screen readers announce the shortcut the same way they would announce a menu accelerator. The row's `<li>` carries `data-row-shortcuts="true"` when the flag is ON (and `"false"` when OFF) so DOM-level tests and screenshots can pin the contract.

**Why a row-scoped handler, not a global `document` listener.** The shortcut must target the row the user is looking at, not "the currently active flag." A `document`-level handler would need to track which row is "current" (scroll position? last-clicked? first in view?) — every answer is wrong in some flow. Scoping to `onKeyDown` on the `<li>` defers that question to the browser's native focus model: whichever row contains `document.activeElement` is the row the keydown bubbles up from, which is exactly what the admin expects.

**Why not also Enter / Space on the row itself.** The three buttons already handle Enter / Space natively. Adding a row-level `Enter = on` would clash with the expand button and the future doc link; leaving the existing button semantics untouched keeps the keyboard model obvious.

**Delivered files.**

- `src/utils/flagsPanelRowShortcutsFlag.ts` — resolver + `FLAGS_PANEL_ROW_SHORTCUTS_FLAG_KEYS` (URL ▸ localStorage ▸ env ▸ default-ON).
- `src/utils/chatV9FeatureFlags.ts` — registered as `flags-panel-row-shortcuts` (ticket `AG1.10`, block `admin`, `specDocs` → this anchor).
- `src/components/Admin/ChatV9FlagsPanel.tsx` — new `isRowShortcutsEnabled` prop seam, `handleRowKeyDown(flagId, event)` callback with the modifier / editable-surface guards, `data-row-shortcuts` attribute on each row, and a new `keyShortcut?: string` prop on the internal `ToggleButton` that forwards to `aria-keyshortcuts`.
- `src/components/Admin/__tests__/ChatV9FlagsPanel.test.tsx` — 13 new `AG1 v1.10:` cases covering: `data-row-shortcuts` attribute ON / OFF, `aria-keyshortcuts` presence / absence, each of `o` / `f` / `d` writing through with `preventDefault`, descendant-button keydown bubbling up, kill-switch OFF being a full no-op, every modifier combination being ignored, uppercase letters being ignored, unrelated keys not preventing default, `<input>` keydown being typing-safe, and two rows routing their own keys to their own flag ids.

**DoD (all met).**

- ✅ Kill-switch `?ff_flagsPanelRowShortcuts=0` (or `localStorage['ff.flags_panel_row_shortcuts'] = '0'`) removes both the `onKeyDown` handler and every `aria-keyshortcuts` attribute; DOM matches pre-AG1-v1.10 output.
- ✅ Modifier-key combinations (`⌘O`, `Ctrl+F`, `Alt+D`, `Shift+O`) are always ignored.
- ✅ Keypresses inside `<input>` / `<textarea>` / `<select>` / `contenteditable` are always ignored.
- ✅ Uppercase letters are not aliases for the lowercase shortcuts.
- ✅ `aria-keyshortcuts` announces the shortcut on each matching button when the flag is ON.
- ✅ Zero new telemetry.
- ✅ No persistence beyond the existing `ff.*` kill-switch keys.

**Out of scope for v1.10.**

- **Row-to-row navigation shortcuts (`j` / `k`, Arrow keys on the row itself).** Roving focus across dozens of rows is a bigger ergonomics piece that belongs with a dedicated "admin keyboard nav" ticket. v1.10 is intentionally the smallest delta: once focus is on a row, flipping it is one key.
- ~~**Shortcut cheat sheet in the panel header.**~~ Shipped in AG1 v1.11 — see below.
- **Persisted "last-used row" indicator.** The panel intentionally resets every time it mounts; a durable indicator would need its own storage contract.
- **Composite shortcuts (`go o`, `t o`, etc.).** Single-letter shortcuts are the honest MVP — every composite requires a mini-modal parser, which is a different scope.

<a id="ag1-v111"></a>

<a id="ag1-v111"></a>

### AG1 v1.11 · Admin flag panel · header shortcut cheat-sheet pill

**Status:** ✅ Shipped (2026-04-18, wave M1)

**Why now.** AG1 v1.10 wired the `o` / `f` / `d` row shortcuts and advertised them to assistive tech through `aria-keyshortcuts`, but sighted admins without a screen reader have no visible hint that the shortcuts exist. Every admin who learns about them today learns by accident or by reading a release note. v1.11 closes that discoverability gap with the smallest possible affordance: a single-line pill under the panel heading that says what the three keys do. It is label-only — no new handlers, no new writes, no telemetry.

**Behaviour.**

- Renders a `Shortcuts · o ON · f OFF · d default` strip inside the panel header, below the existing overrides summary line.
- Each accelerator letter is wrapped in a `<kbd>` element so assistive tech and copy-out tools treat it as a keyboard-input label, matching the way native menus render accelerators.
- The strip carries a human-readable `aria-label` describing all three shortcuts in sentence form so users who land on the pill with a screen reader hear the intent without having to parse three separate `<kbd>` nodes.
- **Dual-kill-switch gating.** The pill renders if and only if BOTH `ff.flags_panel_row_shortcuts` (AG1 v1.10) AND `ff.flags_panel_shortcut_cheat_sheet` (this ticket) resolve ON. Flipping v1.10 OFF hides the pill automatically, because advertising a shortcut the handler is not serving would be a lie; flipping v1.11 OFF while v1.10 stays ON lets tenants keep the behaviour without the visible UI.
- No keydown handler of its own. Pressing `o` / `f` / `d` on the pill does nothing — the shortcut only fires when focus is inside a row, as documented in AG1 v1.10. The pill is visual scaffolding around the existing contract.

**Delivered files.**

- `src/utils/flagsPanelShortcutCheatSheetFlag.ts` — resolver + `FLAGS_PANEL_SHORTCUT_CHEAT_SHEET_FLAG_KEYS` (URL ▸ localStorage ▸ env ▸ default-ON).
- `src/utils/chatV9FeatureFlags.ts` — registered as `flags-panel-shortcut-cheat-sheet` (ticket `AG1.11`, block `admin`, `specDocs` → this anchor).
- `src/components/Admin/ChatV9FlagsPanel.tsx` — new `isShortcutCheatSheetEnabled` prop seam, a derived `shortcutCheatSheetEnabled` boolean that composes v1.10 + v1.11 into a single JSX gate, and the pill markup under the panel heading with per-letter `<kbd>` elements and a sentence `aria-label`.
- `src/components/Admin/__tests__/ChatV9FlagsPanel.test.tsx` — 7 new `AG1 v1.11:` cases covering: pill renders when both flags are ON, contains `o` / `f` / `d` inside `<kbd>` elements with matching `ON` / `OFF` / `default` labels, carries a human-readable `aria-label`, disappears when v1.11 OFF, disappears when v1.10 OFF, disappears when both OFF, and never triggers a write on its own keydown.

**DoD (all met).**

- ✅ Kill-switch `?ff_flagsPanelShortcutCheatSheet=0` (or `localStorage['ff.flags_panel_shortcut_cheat_sheet'] = '0'`) removes the pill; header layout matches pre-AG1-v1.11 output.
- ✅ Flipping AG1 v1.10 OFF removes the pill even if v1.11 is ON.
- ✅ Pill carries `data-testid="chat-v9-flags-shortcut-cheat-sheet"`, `data-shortcut-cheat-sheet="true"`, and a human-readable `aria-label`.
- ✅ Pill has no `onKeyDown` handler of its own; `o` / `f` / `d` keydown on the pill does not touch the flag store.
- ✅ Zero new telemetry.
- ✅ No persistence beyond the existing `ff.*` kill-switch keys.

**Out of scope for v1.11.**

- **Full admin keyboard help overlay.** A `?`-triggered modal that lists every shortcut across the panel, overlay, and related admin surfaces is a bigger ticket — it needs a shortcut registry, a focus-trap, and its own URL state, and belongs with the row-to-row nav piece still open from v1.10.
- **Per-row mini cheat-sheet popover on hover / focus.** Announcing per-row would duplicate `aria-keyshortcuts` visually while fighting tooltip-placement across a long list. The header pill is the global affordance; per-row is noise.
- **Localisation of the `ON` / `OFF` / `default` labels.** The admin panel is English-only today; Polish / other translations are a cross-cutting pass, not a scope for this ticket.
- **Styling toggles / theming.** The pill uses the existing slate/navy palette; a tenant-customizable palette for kbd chrome is out of scope.

<a id="ag1-v112"></a>

<a id="ag1-v112"></a>

### AG1 v1.12 · Admin flag panel · "Copy override URL" button

**Status:** ✅ Shipped (2026-04-18, wave M1)

**Why now.** AG1 v1.2 taught the panel to copy a flag *snapshot* as Markdown — great for incident tickets, useless for "open my exact config on another machine". Reproducing an override set today means either walking a colleague through the panel row-by-row or emailing a `localStorage` dump. v1.12 closes that gap with a single shareable URL: every current override is encoded as `?<flag.keys.query>=0|1`, and opening the URL on any browser lets Chat V9's URL-first resolution path reproduce the exact state for that tab. Natural follow-on to v1.2 with the same ergonomics and zero new infra.

**Behaviour.**

- Renders a second header button next to the v1.2 `Copy snapshot` button, labelled `Copy URL` (with a link glyph) in the idle state. `Copied` / `Copy failed` replace the label during the transient feedback window.
- The button is **disabled** while the snapshot reports zero overrides — there is no value in a URL that encodes "everything at shipped defaults", and surfacing a no-op write would be misleading. The `aria-label` swaps to `No overrides to share — every flag is at its shipped default` in that state.
- Clicking writes the builder's output to the clipboard via the AG1 v1.2 clipboard helper (`copyTextToClipboard`), reusing its `navigator.clipboard` → `execCommand('copy')` fallback so insecure-context tunnels still work. On success the button flashes `Copied` for 2 s; on failure it flashes `Copy failed` for the same window. Feedback is **independent** from the v1.2 snapshot button — flashing one never steals the other's state.
- **URL shape (deterministic):**
  - Overrides are emitted in `CHAT_V9_FLAGS` registry order — the same override set always produces the same URL byte-for-byte, so screenshots in tickets are diffable.
  - Flags matching their shipped default are omitted; the URL stays lean (only what's different from default).
  - Non-`ff_*` query params already in the admin's tab (`?tenant=acme`, `?v9flags=1`, etc.) are preserved verbatim. Dropping them would silently break the admin's current flow.
  - Any pre-existing `ff_*` params in the tab are dropped and replaced with the current override set — the URL is a *snapshot* of "what the panel says right now", not a merge of a stale URL and fresh overrides.
  - Idempotent: round-tripping the output through `new URL()` and re-running the builder returns the same URL.

**Why not just write the current tab URL verbatim.** The admin's current URL may contain stale `ff_*` values (they flipped flags in the panel after landing), or reflect an earlier override set. Re-emitting verbatim would ship a URL that contradicts the panel's own state.

**Why ordering matters.** Two admins sharing "the same" override set must produce the same URL. Registry order is a stable total order; override-map iteration order is engine-dependent and would defeat diff-ability.

**Delivered files.**

- `src/utils/buildChatV9FlagOverrideUrl.ts` — pure builder. Takes an explicit `flags`, `getOverride`, and `location` snapshot (test-injectable) and returns a URL string. Production defaults read from `CHAT_V9_FLAGS`, `getChatV9FlagOverrideState`, and `window.location`.
- `src/utils/flagsPanelOverrideUrlCopyFlag.ts` — resolver + `FLAGS_PANEL_OVERRIDE_URL_COPY_FLAG_KEYS` (URL ▸ localStorage ▸ env ▸ default-ON).
- `src/utils/chatV9FeatureFlags.ts` — registered as `flags-panel-override-url-copy` (ticket `AG1.12`, block `admin`, `testId: 'chat-v9-flags-copy-override-url'`, `specDocs` → this anchor).
- `src/components/Admin/ChatV9FlagsPanel.tsx` — new `isOverrideUrlCopyEnabled` + `buildOverrideUrl` prop seams, an independent `overrideUrlFeedback` state machine + timer ref, a `handleCopyOverrideUrl` callback, and a second header button with distinct aria-labels for idle / copied / failed / disabled states.
- `src/utils/__tests__/buildChatV9FlagOverrideUrl.test.ts` — 11 new cases covering: bare URL when no overrides, ON → `=1` and OFF → `=0` encoding, registry-order ordering, default-flag skipping, non-`ff_*` param preservation, stale `ff_*` param replacement, idempotence, missing / leading `?` handling, and empty registry graceful-degrade.
- `src/components/Admin/__tests__/ChatV9FlagsPanel.test.tsx` — 8 new `AG1 v1.12:` cases covering: kill-switch OFF hides the button, rendered-but-disabled with zero overrides, enabled when any override lands, click writes the builder output to the clipboard, `idle → copied → idle` fake-timer transition, async-failure transition to `failed`, builder-throw transition to `failed` without calling the writer, feedback-state independence from AG1 v1.2, and aria-label coverage across all four states.

**DoD (all met).**

- ✅ Kill-switch `?ff_flagsPanelOverrideUrlCopy=0` (or `localStorage['ff.flags_panel_override_url_copy'] = '0'`) removes both the button and its handler; the header layout matches the pre-AG1-v1.12 build pixel-for-pixel.
- ✅ Button is disabled when `overridesCount === 0`.
- ✅ URL encodes overrides in registry order so the output is diffable and stable.
- ✅ Non-`ff_*` query params the admin already has are preserved verbatim.
- ✅ Pre-existing `ff_*` params are dropped and replaced with the current override set.
- ✅ Idempotent — round-tripping the output does not accumulate params.
- ✅ Clipboard failures (both async-resolved and thrown) land in `failed` with a distinct `aria-label`.
- ✅ Zero new telemetry.

**Out of scope for v1.12.**

- **QR-code rendering of the URL.** Useful on conference stages, overkill in a rescue tool; add later if telemetry shows adoption.
- **Short-link generation.** Would require a server-side redirector and adds an SSRF surface. The raw URL is fine for Slack / JIRA / Notion.
- **Encoding `localStorage` overrides that are NOT registered `CHAT_V9_FLAGS`.** The URL is specifically the V9 override set; arbitrary `ff.*` keys outside the registry are out of scope (and probably stale).
- **Import via paste back into the panel.** URL-first resolution already handles this — opening the URL in another tab is the import path. A dedicated "paste URL and apply" input would duplicate that flow without adding coverage.
- **Clickable link-preview inside the panel.** Surfacing the URL inline as a text field would beg the question "should I edit it?"; the copy-and-open flow is simpler and less error-prone.

<a id="ag1-v113"></a>

<a id="ag1-v113"></a>

### AG1 v1.13 · Admin flag panel · Escape clears the filter input

**Status:** ✅ Shipped (2026-04-18, wave M1)

**Why now.** AG1 v1.5 shipped the filter input with an `X` clear button, but the cheapest clear gesture — the one admins land on without thinking — is `Escape`. Until v1.13, pressing `Escape` while the filter had focus bubbled to the `ChatV9FlagsOverlay` and closed the whole panel, taking a typo'd filter down with it. v1.13 makes `Escape` first clear the filter text, and only dismiss the overlay when the filter is already empty. This is APG's documented search-input pattern (Escape clears, then closes) and matches every serious admin tool the team has worked with.

**Behaviour.**

- `Escape` while the filter input has focus AND contains text:
  - Clears the text.
  - `preventDefault()` so the browser does not trigger any native "reset autofill" side effect.
  - `stopPropagation()` so the overlay does NOT also handle it as "close".
  - Advertised via `aria-keyshortcuts="Escape"` on the input, so screen readers announce the accelerator at focus.
- `Escape` while the input is empty: deliberately not handled. The overlay keeps its one-keystroke close for admins who want to exit without first blurring the filter.
- Non-`Escape` keys (`Enter`, typing, arrow keys, `Tab`) are untouched — the filter's existing keyboard semantics stay intact.
- Kill-switch OFF restores the pre-AG1-v1.13 bubble-through path pixel-for-pixel:
  - No `aria-keyshortcuts` on the input.
  - `data-escape-clear="false"` so integration tests can pin the OFF path.
  - Every `Escape` bubbles to the overlay regardless of content.

**Delivered files.**

- `src/utils/flagsPanelFilterEscapeClearFlag.ts` (NEW) — standard resolver + `FLAGS_PANEL_FILTER_ESCAPE_CLEAR_FLAG_KEYS` (URL ▸ localStorage ▸ env ▸ default ON).
- `src/utils/chatV9FeatureFlags.ts` — registered as `flags-panel-filter-escape-clear` (ticket `AG1.13`, block `admin`).
- `src/components/Admin/ChatV9FlagsPanel.tsx`:
  - New `isFilterEscapeClearEnabled` prop seam alongside the existing AG1 v1.5 seam.
  - Derived `filterEscapeClearEnabled` boolean read once per render.
  - New `handleFilterKeyDown` memoised callback that bails early when the flag is OFF, when the key is not `Escape`, or when the filter is empty; otherwise clears the query and kills the event. Guards against double-handling via `event.isPropagationStopped?.()` and `event.defaultPrevented`.
  - `onKeyDown={handleFilterKeyDown}`, `data-escape-clear`, and conditional `aria-keyshortcuts` on the input.
- `src/components/Admin/__tests__/ChatV9FlagsPanel.test.tsx` — 8 new `AG1 v1.13:` cases covering: Escape clears a non-empty filter, Escape on an empty filter is a no-op that preserves bubble, non-Escape keys never clear, kill-switch OFF lets Escape bubble even when text is present, kill-switch ON advertises `aria-keyshortcuts="Escape"`, kill-switch OFF removes the shortcut announcement and flips `data-escape-clear` to `"false"`, the handler actually clears across fire, and repeated clear / type cycles work.

**DoD (all met).**

- ✅ Escape + non-empty filter clears the filter and does not close the panel.
- ✅ Escape + empty filter is untouched — overlay keeps its one-keystroke dismiss.
- ✅ `aria-keyshortcuts="Escape"` only appears while the behaviour is live.
- ✅ Kill-switch `?ff_flagsPanelFilterEscapeClear=0` (or `localStorage['ff.flags_panel_filter_escape_clear'] = '0'`) restores the pre-AG1-v1.13 bubble-through path; `data-escape-clear="false"` lets integration tests pin the OFF path.
- ✅ Zero new telemetry.

**Out of scope for v1.13.**

- **Focus restoration after clear.** The input keeps focus — admins can keep typing the next query without a tab-to-search detour. Stealing focus elsewhere on clear would surprise keyboard flows.
- **Confirm-before-clear modal.** A single Escape is cheap to replay (Cmd+Z in most inputs, or retype). Adding a confirm layer would double the number of keystrokes for the common case.
- **Debounced clear animation.** The filter already re-runs synchronously; a transition on the input would fight the admin's mental model of "I pressed the key, it's cleared".
- **`Ctrl+Backspace` word-level clear.** Already covered natively by the browser's text-input handling — we don't need to re-implement it.
- **Global `/` to focus the filter from anywhere in the panel.** Separate ticket; the open-panel overlay focus-traps the admin already, so the value add there is small.

## Not shipped yet

The rest of the ADMIN lane — capabilities configuration, usage
dashboards, governance rules, tenant-level controls — is design-doc
territory only and not represented in this folder until code lands.
