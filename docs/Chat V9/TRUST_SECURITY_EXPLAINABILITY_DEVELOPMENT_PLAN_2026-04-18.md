# Chat V9 / TRUST — development plan (2026-04-18)

> **Scope note:** this plan documents TRUST-block tickets that are actually
> shipped on `develop`. The wider TRUST roadmap (citations, reasoning
> reveal, full scope summary, ...) exists as design material; here we
> track only tickets with live code + tests + a flag on this branch.

> **Cross-refs**
> - Kill-switches & incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new trust feature → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md)

## Shipped

| ID | Title | Effort | Priority | Risk | Status |
|---|---|---|---|---|---|
| [T-PM1](#t-pm1) | Private Mode details popover | 0.5 d | P1 | low | ✅ |
| [T-TR1](#t-tr1) | AI response trust badge | 1 d | P0 | low | ✅ |
| [T-TR1.2](#t-tr1-2) | Trust badge model label humanizer | 0.3 d | P1 | very low | ✅ |
| [T-TR1.3](#t-tr1-3) | Trust badge copy citations button | 0.3 d | P1 | very low | ✅ |
| [T-TR1.4](#t-tr1-4) | Trust badge copy reasoning button | 0.3 d | P2 | very low | ✅ |
| [T-TR3-lite](#t-tr3-lite) | Trust badge per-citation clickable link | 0.4 d | P1 | very low | ✅ |
| [T-TR3.4](#t-tr34) | Trust badge citation row · domain pill | 0.3 d | P2 | very low | ✅ |

---

## T-PM1

**Private Mode details popover.** The existing "Private mode" badge in
`UnifiedChatPanel` was a passive chip with a one-line static tooltip
("Disable memory injection and personalization for this chat"). That
copy is ambiguous — it reads like "private mode means nothing leaves my
device", which is **not** what the feature does. This ticket replaces
the chip with a button whose popover honestly states what private mode
does AND does not do, plus how to exit.

### Delivered

- `src/components/AIChat/PrivateModeDetails.tsx` — button + popover.
  Three content rows:
  1. **Turned off for this chat** — long-term memory; personalisation
     prompt injection.
  2. **Still happens** — message content still reaches the model;
     operational logs (latency, errors) are retained without message
     content.
  3. **Exit hint** — one-line instruction to toggle the mode back off.
  Close-on-Escape, close-on-outside-click, ARIA dialog semantics.
- `src/utils/privateModeDetailsFlag.ts` — `ff.private_mode_details`
  flag (default ON). When OFF, the component renders the **legacy**
  static chip (same classes, same tooltip) so the kill-switch is
  visually invisible.
- `src/components/AIChat/UnifiedChatPanel.tsx` — swapped the inline
  `<div>` chip + unused `Lock` import for the new component. The chip
  still renders only when `aiConfig.privateMode === true`, unchanged.
- Telemetry: `private_mode_details_opened` — one event per open
  gesture. Empty payload (no ids, no content). Registered in
  `funnelAnalytics.ts` with an inline PII contract comment.
- Tests: see [`PrivateModeDetails.test.tsx`](#) — flag gate (ON + OFF),
  popover open/close, Escape key, outside click, telemetry fires on
  open, telemetry fires on every re-open, popover still renders when
  telemetry throws.

### DoD

- [x] User who sees the "Private mode" badge can one-click to learn
      exactly what it guarantees and what it does NOT guarantee. RODO
      honesty over marketing honesty.
- [x] Kill-switch (`?ff_privateModeDetails=0` or
      `localStorage['ff.private_mode_details'] = '0'`) restores the
      legacy chip pixel-perfect.
- [x] No change to `aiConfig.privateMode` or any backend call — this is
      purely an explainer surface.

### Deliberately out of scope

- Programmatic "turn off private mode" action from inside the popover.
  The existing mode menu is the source-of-truth toggle; duplicating it
  would risk drift between the two surfaces.
- Version-stamping the policy copy. If the backend privacy contract
  changes, a new ticket should update the copy + a `policy_version`
  telemetry field in one PR, not this one.
- Surfacing the "private by default for this tenant" signal. That's an
  admin concept and belongs in the AG1 control hub, not in chat.

---

## T-TR1

**AI response trust badge.** Render a compact always-visible chip
beneath every non-streaming AI reply that summarises "where does this
answer come from?". Today the chat surface has a full `CitationList`
(when citations exist) and WIP stubs for `TrustPanel` / `SourcesStrip`
that both render `null`. On a busy scroll a user has no at-a-glance
signal for whether a given reply cites anything at all.

### Delivered

- `src/components/AIChat/TrustBadge.tsx` — chip + click-to-expand
  popover. Two tones: emerald when citations are present ("3 sources"),
  amber when the reply has none ("No cited sources"). Optional model
  suffix (`· GPT-4o`) rendered only when `msg.metadata.modelUsed` is a
  clean non-empty string.
- Popover content: first 5 citation titles, honest "sources tell you
  what was retrieved — always verify claims that matter to you"
  disclaimer, and a `…and N more` hint when there are more than 5.
- `src/utils/trustBadgeFlag.ts` — `ff.trust_badge` (default ON).
  Kill-switch: when OFF the component returns null; the existing
  `CitationList` and WIP trust stubs are untouched.
- `src/components/AIChat/MessageRenderer.tsx` — chip placed directly
  above the existing `CitationList` slot so skim-readers see the
  summary BEFORE the detail expands.
- Defensive input: `normalizeCitations()` accepts `unknown` and filters
  entries that lack both `id` and `title`; non-array inputs fall to
  zero without throwing. Explicit test coverage for malformed payloads.
- Telemetry: `trust_badge_opened` — closed-enum payload
  `{ sourceCount: 'none' | 'few' | 'many', hasModel: boolean }`. Raw
  counts, titles, and model names are never emitted. Regression test
  freezes this contract.
- Tests: 14 passing — flag gate, label rendering, popover
  open/close/Escape/outside-click, 5-of-N truncation, bucket contract,
  telemetry-throws-gracefully, and explicit PII guard on the payload.

### DoD

- [x] Every AI reply (with or without citations) carries a one-glance
      "this is / isn't backed by retrieved sources" signal.
- [x] Flag kill-switch restores the previous layout pixel-perfect.
- [x] Telemetry cannot leak citation text, model names, or raw counts.
      Enforced by a test that asserts the exact payload shape.
- [x] Pure read surface — never mutates `msg`, never refetches, never
      talks to the backend.

### Deliberately out of scope

- Replacing `CitationList` or re-implementing the WIP `TrustPanel`.
  The badge is a summary on top of those surfaces, not a substitute.
- Surfacing the opaque `trustBundle` itself. Shape is unknown on this
  branch (`unknown` in every consumer); rendering speculative fields
  would be dishonest. When the real `TrustPanel` lands it can consume
  `trustBundle` freely — the badge stays a summary.
- Deep-linking from the badge popover to each citation. `CitationList`
  already handles that below; duplicating would risk drift.

---

<a id="t-tr1-2"></a>

## T-TR1.2

**Trust badge model label humanizer.** T-TR1 shipped the badge with a
raw `msg.metadata.modelUsed` suffix ("· gpt-4o-2024-08-06", "·
e3b0c442-98fc-1c14-9afb-c4e9c4e9c4e9"). Raw ids look like infrastructure
leaking onto the glass: dated suffixes are noise, and internal uuids for
org-private models should never appear verbatim on a screenshot. This
ticket swaps the raw string for a small dictionary + heuristic formatter,
and surfaces the humanised label on a second row inside the popover so
users who expand the badge see both "what backs this reply" (citations)
AND "who answered" (model) without further clicks.

### Delivered

- `src/utils/formatTrustBadgeModelLabel.ts` — pure formatter. Turns
  `gpt-4o-2024-08-06` → `GPT-4o`, `claude-3-5-sonnet-20241022` →
  `Claude 3.5 Sonnet`, `gemini-1.5-pro` → `Gemini 1.5 Pro`,
  `mixtral-8x7b-instruct` → `Mixtral 8x7B`, `llama-3.1-405b` →
  `Llama 3.1`. UUID-shaped ids mask to the sentinel `"Private model"`
  rather than leaking verbatim. Unknown vendors pass through
  unchanged but clipped to 32 characters with an ellipsis so a
  malformed backend cannot blow up the chip horizontally. Matching
  is case-insensitive; whitespace is trimmed.
- `src/utils/trustBadgeHumanizeModelFlag.ts` — `ff.trust_badge_humanize_model`
  flag (default ON) with the standard URL → localStorage → env →
  default resolution order. Gates both the inline pill humanisation
  and the new popover row.
- `src/components/AIChat/TrustBadge.tsx` — replaces the local
  "trim and pass through" with `formatTrustBadgeModelLabel()` when the
  humanizer flag is ON; otherwise keeps the pre-T-TR1.2 behaviour
  pixel-identical so the kill-switch is a clean rollback. Adds an
  "Answered by <model>" row at the top of the popover body
  (`data-testid="trust-badge-answered-by"`), rendered only when both
  the humanizer flag is ON and a label resolved — so the line stays
  in sync with the trigger pill.
- Telemetry: unchanged. The existing `trust_badge_opened` payload
  continues to emit `hasModel: boolean` as a closed enum; humanising
  the label never changes the boolean. No new events, no new fields.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `trust-badge-humanize-model` with its keys and descriptor so it
  shows up in the AG1 admin dashboard.
- Tests: `formatTrustBadgeModelLabel.test.ts` (23 cases covering
  every vendor family, UUID masking, case-insensitivity, clipping,
  unknown passthrough). Extends `TrustBadge.test.tsx` with 7 extra
  cases covering humanizer ON / OFF, UUID masking in the live pill,
  the "Answered by" popover row rendering only when both gates pass,
  and the telemetry `hasModel` invariant under masking.

### DoD

- [x] Raw dated / uuid model ids never appear on screen when the
      humanizer is ON. UUIDs mask to `"Private model"`; dated
      suffixes collapse to the family label.
- [x] Kill-switch (`?ff_trustBadgeHumanizeModel=0` or
      `localStorage['ff.trust_badge_humanize_model'] = '0'`) restores
      the T-TR1 pill text AND drops the new popover row.
- [x] Telemetry contract is untouched — no new fields, no new events,
      `hasModel` stays a boolean driven by label presence.
- [x] No backend call, no state mutation, no regression in T-TR1
      behaviour (existing T-TR1 tests all still pass).

### Deliberately out of scope

- Vendor logos / colour-per-family treatment. Readable text labels
  are a much cheaper win and avoid needing to ship vendor trademarks.
- Translating labels. `"GPT-4o"` / `"Claude 3.5 Sonnet"` are product
  names, not UI copy; keeping them untranslated matches every vendor's
  own documentation.
- Emitting the humanised label in telemetry. We only need the boolean
  (`hasModel`) to answer "do we have the metadata at all?"; surfacing
  the actual model name in analytics creates a new RODO debate for
  zero product-decision value on this milestone.
- Extending the dictionary beyond vendors we actually route to today.
  The unknown-vendor passthrough + clip handles long-tail cases
  without requiring us to predict the entire model catalogue.

---

<a id="t-tr1-3"></a>

## T-TR1.3

**Trust badge copy citations button.** T-TR1 landed the popover
that lists up to five citation titles; users reported that the
single most common follow-up action is "paste those into my Notion
working doc". Today that requires manually copying each title,
which is fiddly and destroys the link structure. This ticket adds
a tiny "Copy" button to the popover footer that serialises the
citation list to a deterministic Markdown block — title, link, and
reference — and writes it to the system clipboard via the same
`copyTextToClipboard` helper AG1 v1.2 uses. Zero new surfaces,
zero new telemetry, zero new permissions.

### Delivered

- `src/utils/buildTrustBadgeCitationsText.ts` — pure formatter.
  Emits `Sources for this reply (answered by <model>):` (the
  "answered by" clause appears only when a humanised model label
  is available, so T-TR1.2 OFF collapses this row cleanly). Each
  citation is rendered as `N. [title](link) — ref:<reference>`,
  with the link wrapper and the reference suffix each conditional
  on a non-empty value. Pipes in titles are escaped so a paste
  into a Notion table round-trips safely. Entries with empty
  titles are skipped; numbering always runs `1, 2, 3, …` without
  gaps. Empty / null / all-invalid inputs degrade to
  `Sources for this reply:\n\nNo cited sources.` rather than
  emitting an empty clipboard.
- `src/utils/trustBadgeCopyCitationsFlag.ts` —
  `ff.trust_badge_copy_citations` flag (default ON). Exists purely
  as an operational kill-switch in case the clipboard API surfaces
  a Permissions-Policy failure on a hosted domain.
- `src/components/AIChat/TrustBadge.tsx` — renders the button in
  the popover footer only when (a) the flag is ON and (b) at
  least one citation exists. Three transient states (`Copy` →
  `Copied` / `Copy failed`) mirror AG1 v1.2's Copy-snapshot
  button, reusing the same lucide icons (`ClipboardCopy`,
  `ClipboardCheck`, `ClipboardX`). Closing the popover resets the
  feedback so re-opening never flashes stale state. The button
  reuses the AG1 v1.2 `copyTextToClipboard` helper so the
  modern-async → execCommand fallback path is exercised by one
  set of tests.
- Telemetry: none. The existing `trust_badge_opened` event already
  answers "did users open this surface at all?"; a dedicated
  copy-click event would mostly duplicate that signal and pull the
  ticket into a RODO review for zero product-decision value.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `trust-badge-copy-citations` (ticket `T-TR1.3`, block `trust`,
  `testId: 'trust-badge-copy-citations'`) so it shows up in the
  AG1 admin dashboard alongside every other V9 flag.
- Tests: `buildTrustBadgeCitationsText.test.ts` (14 cases: header
  rendering with / without model, graceful null-array handling,
  numbered list, `[title](link)` vs plain title, reference suffix
  conditional rendering, pipe escaping, skipped empty titles,
  all-empty fallback, deterministic ordering). Extends
  `TrustBadge.test.tsx` with 9 extra cases covering: flag OFF
  hides the button, no-citations hides the button, the exact
  Markdown payload sent to the clipboard (with and without T-TR1.2
  ON), `copied` / `failed` transient states, rejected promises,
  popover-close resetting feedback, and the "no telemetry from
  copy clicks" invariant.

### DoD

- [x] Users who open the Trust Badge popover can one-click to
      grab the citation list as a Markdown block they can paste
      into Notion / GitHub / Slack.
- [x] Kill-switch (`?ff_trustBadgeCopyCitations=0` or
      `localStorage['ff.trust_badge_copy_citations'] = '0'`)
      restores the pre-T-TR1.3 popover pixel-perfect.
- [x] No new telemetry fields, no new events — the copy-click path
      is a pure local affordance.
- [x] Numbering stays `1, 2, 3, …` even when backend sends entries
      with empty titles (explicit test).

### Deliberately out of scope

- A dropdown to choose copy format (Markdown vs plain text vs
  BibTeX). Markdown is the format every downstream surface we
  care about (Notion, GitHub, Slack) renders natively; adding a
  picker doubles the surface area for one-more-click value.
- Copying the model reasoning / chain-of-thought. Not available on
  this branch and would pull the ticket into the reasoning-reveal
  work that lives in a separate milestone.
- Emitting a copy-click event. See telemetry note above — the
  existing `trust_badge_opened` event is enough to answer the
  product question ("do people engage with the popover?"); adding
  a per-click event would cost a RODO review for marginal
  dashboard value.
- Keyboard shortcut (`Cmd+Shift+C` etc.) to copy without opening
  the popover. Chord collision risk with browser defaults; better
  as a future ticket with explicit user ask.

---

## T-PM2-lite

**Post-send PII heuristic toast.** The TRUST audit flagged that
Chat V9 has no gentle way to tell a user "you just sent Teresa an
email address / phone / IBAN — are you sure?" today. The full
`T-PM2` ticket covers server-side PII redaction, which is a weeks-
long body of work; this `-lite` slice is a one-shot client-side
nudge that buys the visible product value of the full ticket
without touching the send path or the context store. The detector
is pure, lean, and explicitly a heuristic: it is a "do you want to
double-check?" prompt, not a compliance scanner.

### Delivered

- `src/utils/piiHeuristic.ts` — pure `detectPiiCategories(text)`
  returning a closed-enum array ordered `email → phone → iban`,
  never duplicated. Email is matched by a loose `local@host.tld`
  regex. Phone candidates must resolve to 9–15 digits after
  stripping separators (so ISO dates like `2026-04-18` are
  rejected). IBAN candidates must land in the standard
  15–34-char range after stripping whitespace, so short
  `PL01 1234` fragments are rejected. No PESEL / NIP / credit-card
  detection — see out-of-scope below.
- `src/utils/piiHeuristicToastFlag.ts` — `ff.pii_heuristic_toast`
  kill-switch (default ON) plus the exported
  `CHAT_V9_PII_CHECK_EVENT` name (`chat-v9-pii-check`) the input
  and the toast component share.
- `src/components/AIChat/EnhancedChatInput.tsx` — dispatches the
  CustomEvent from inside `handleSend` right after `onSend()`
  fires, with `detail: { text }`. The event is a pure side-effect
  hook; any error (exotic environments without `CustomEvent`)
  silently no-ops.
- `src/components/AIChat/PiiHeuristicToast.tsx` — headless
  listener mounted at the App root. Runs the detector when the
  flag is ON, fires a neutral `react-hot-toast` nudge
  (`⚠️ Heads up — your last message looks like it contains
  <categories>`) with a 4.5s stick time, and emits a PII-free
  `pii_heuristic_warning_shown` telemetry event with
  `{ categories: [...] }` only. A 4 s cooldown keeps a rapid
  multi-send burst from piling up warnings on screen. `isEnabled`
  and `notify` are injected as test seams so the tests never need
  to render the toast surface.
- `src/services/funnelAnalytics.ts` — adds
  `pii_heuristic_warning_shown` to the closed-enum event union,
  with a PII-contract comment that explicitly names what the
  payload may and may not include.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `pii-heuristic-toast` (ticket `T-PM2`, block `trust`,
  `telemetry: ['pii_heuristic_warning_shown']`) so the admin
  dashboard shows the kill-switch and links back to this plan.
- Tests: `piiHeuristic.test.ts` (17 cases pinning the closed-enum
  contract, empty / non-string input, email / phone / IBAN hits,
  ISO-date + ticket-id phone-rejection, contiguous and
  space-grouped IBAN, priority ordering, no duplicate emissions).
  `PiiHeuristicToast.test.tsx` (10 cases: no-PII silence, email
  hit → toast + telemetry, multi-category ordering, raw text
  never leaks into payload, kill-switch OFF detaches listener,
  cooldown throttles follow-up, fires again after cooldown,
  non-string `detail.text` ignored, throwing notifier does not
  crash listener, unmount removes listener).

### DoD

- [x] Sending a message with an email / phone / IBAN triggers a
      single neutral toast and exactly one
      `pii_heuristic_warning_shown` event carrying only the
      closed-enum category array.
- [x] Sending a plain message triggers nothing — no toast, no
      telemetry, no detector run on a ghost string.
- [x] Kill-switch (`?ff_piiHeuristicToast=0` or
      `localStorage['ff.pii_heuristic_toast'] = '0'`) detaches
      the listener entirely; the dispatch in the input is a
      no-op.
- [x] Rapid consecutive sends inside the 4 s cooldown collapse to
      one toast and one telemetry event.
- [x] Telemetry payload is a closed-enum array — raw text,
      substrings, lengths, and ids never leave the client.

### Deliberately out of scope

- PESEL / NIP / credit-card detection. Each has meaningfully
  higher false-positive risk than email / phone / IBAN and
  deserves its own ticket with a closed-enum category token.
- Pre-send blocking / confirmation modal. That is the `T-PM2`
  heavyweight ticket; the whole point of `-lite` is to avoid
  interrupting the send.
- Server-side redaction, context-store scrubbing, or admin
  dashboards of PII events. Those are `T-PM2` proper.
- Localising the toast string. The toast is intentionally English
  while the telemetry / product team validate the categories; a
  follow-up ticket adds `pl` / `en` strings once the category set
  is stable.
- Any persistence of "I already saw this warning, stop showing
  it". See the T-PM2-lite v1.1 follow-up below; that ticket
  ships a per-tab opt-out while keeping the default-ON nudge.

<a id="t-pm2-lite-v11"></a>

<a id="t-pm2-lite-v11"></a>

### T-PM2-lite v1.1 · "Don't show again this session"

**Why.** T-PM2-lite v1 ships a 4 s cooldown between nudges, but
users working through a long transcript of support tickets
(email addresses, phone numbers, IBANs in every row) kept
reporting the toast as "nagging" on their third or fourth paste.
A per-send block is the right shape for the *first* warning —
it's the second, third, tenth that cross into annoyance. Giving
the user a one-click "I heard you, I'll be careful" opt-out
preserves the protective value of the nudge for the rest of the
session without letting it become background noise.

Opt-out scope is intentionally **tab-level**, not
account-level: the next tab / window starts with a fresh
`sessionStorage` so someone who closed their laptop for lunch
and came back to a new workflow still gets the nudge. Users who
want *permanent* opt-out would need the `localStorage`
kill-switch below, which this ticket deliberately does not wire
into the UI.

**Behaviour.**

- When the flag is ON (default), the existing PII toast grows a
  small secondary button: **"Don't show again this session"**.
- Clicking it writes
  `sessionStorage["chatV9.piiToastDismissedForSession"] = "1"`
  and, from that event onwards, the headless listener skips
  every subsequent PII check in the current tab — no toast, no
  telemetry, no detector run. A `Dismiss` button next to it
  closes the current toast without setting the sentinel, for
  users who only want to silence this one instance.
- When the flag is OFF, the toast collapses back to the
  T-PM2-lite v1 shape (message + `⚠️` icon only). The component
  still honours a pre-set sessionStorage sentinel so an admin
  who nukes the v1.1 flag mid-session does not resurrect nudges
  users had explicitly dismissed.
- A defensive `lastFiredAtRef` bump to `Number.MAX_SAFE_INTEGER`
  at opt-out time protects against the next event arriving
  before the sessionStorage write has landed (browser quota,
  private-mode fallbacks); the belt-and-braces guarantees the
  click always works, even when storage does not.

**Delivered.**

- `src/utils/piiHeuristicSessionDismissFlag.ts` (NEW) —
  `ff.pii_heuristic_session_dismiss` resolver (URL →
  localStorage → env → default ON), plus the SSR-safe
  `isPiiToastDismissedForSession()` /
  `markPiiToastDismissedForSession()` helpers and the
  `PII_TOAST_SESSION_DISMISS_STORAGE_KEY` export so the toast,
  its tests, and ops runbooks share one canonical spelling.
- `src/components/AIChat/PiiHeuristicToast.tsx` — notify
  signature extended to
  `(message, { showSessionDismissAction, onDismissForSession })`;
  default notifier now uses `toast.custom` to render a richer
  toast element with the dismiss buttons. Session-dismiss guard
  runs *before* the detector so a dismissed tab never pays the
  regex cost either.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `pii-heuristic-session-dismiss` (ticket `T-PM2.1`, block
  `trust`, empty `telemetry` array).

**DoD.**

- [x] With the flag ON, the PII toast shows the
      "Don't show again this session" button; clicking it
      suppresses every subsequent nudge in the current tab.
- [x] With the flag OFF, the toast renders the v1 shape (no
      extra buttons), and preseeded sessionStorage still wins —
      the nudge cannot be resurrected by flipping the flag.
- [x] A fresh tab with no sessionStorage sentinel renders the
      nudge normally on the first PII hit.
- [x] Session-dismiss guard runs before the detector, so a
      dismissed tab pays zero regex cost on subsequent sends.
- [x] Zero new telemetry events fire. Same PII-free contract
      as v1.

**Deliberately out of scope.**

- **Per-category opt-out** ("stop warning me about IBANs but
  keep emails"). The nudge is already probabilistic at the
  whole-message level; per-category control is overkill for a
  heuristic that is, by design, non-blocking.
- **Permanent (cross-session) opt-out.** Users can still flip
  `localStorage['ff.pii_heuristic_toast'] = '0'` or
  `ff.pii_heuristic_session_dismiss = '0'` manually, but the UI
  deliberately never offers a cross-session dismiss button —
  that would turn a safety nudge into a one-click liability.
- **Telemetry on the dismiss click.** Per-toast interaction
  telemetry would cost a RODO review for marginal product
  insight. The absence of `pii_heuristic_warning_shown` events
  after a dismiss is itself a product signal.
- **Localising the dismiss button label.** English-only, same
  as the rest of Chat V9's small surfaces.

---

## T-TR2

**Trust Badge "Why this answer?" reasoning snippet.** The TRUST
audit flagged explainability as the weakest signal in the popover:
users see *what* was cited (T-TR1), *which* model answered
(T-TR1.2), and can *copy* the citations (T-TR1.3), but the popover
never answers the actual question — **why does this reply look the
way it does?** The full "reasoning reveal" ticket is a multi-week
body of work that would surface the model's chain-of-thought; this
`-lite` slice ships the wayfinding value today by rendering a
deterministic 3-item snippet built purely from the (citationCount,
modelLabel) pair the badge already knows about. No backend change,
no new metadata, no telemetry.

### Delivered

- `src/utils/buildTrustBadgeReasoning.ts` — pure builder returning
  a closed-enum list of observations: `retrieval-strong` (4+
  cited sources), `retrieval-some` (1–3 sources, grammatically
  correct singular at n=1), `retrieval-none` (zero or degraded
  count) + `model-known` / `model-unknown` + an always-present
  `verify` reminder so the disclosure never ends on a smug
  "you're covered" signal. The retrieval thresholds mirror
  `TrustBadge.bucketSourceCount` exactly, so the badge trigger
  ("4 sources") and the disclosure ("Grounded in retrieved
  sources") can never contradict each other. `modelLabel` treats
  empty / whitespace / null / undefined identically as
  `model-unknown`. The list is always non-empty (length = 3).
- `src/utils/trustBadgeReasoningFlag.ts` —
  `ff.trust_badge_reasoning` kill-switch (default ON). Exists
  purely as an operational kill-switch; when OFF the disclosure
  toggle + body do not render and the popover is pixel-for-pixel
  identical to the T-TR1.3 shipped layout.
- `src/components/AIChat/TrustBadge.tsx` — adds a collapsible
  `<button aria-expanded aria-controls>` "Why this answer?"
  disclosure between the source list and the verify-claims
  disclaimer footer. Chevron rotates via `ChevronRight` →
  `ChevronDown`. Each observation renders its `headline` as a
  small uppercase caption and its `body` as a single
  slate-toned line. Closing the popover auto-resets the
  disclosure to collapsed (same mental model as the existing
  `copyFeedback` reset).
- `src/utils/chatV9FeatureFlags.ts` — registers
  `trust-badge-reasoning` (ticket `T-TR2`, block `trust`,
  `testId: 'trust-badge-reasoning'`) so the AG1 admin panel
  surfaces the kill-switch with the rest of the trust-block
  flags.
- Tests: `buildTrustBadgeReasoning.test.ts` (16 cases — closed-
  enum id contract, retrieval bucket thresholds 0 / 1 / 3 / 4 /
  12 with singular grammar at n=1, negative + NaN counts,
  `modelLabel` edge cases (trimmed whitespace, null, undefined,
  empty, whitespace-only), invariant checks on length 3 and
  priority order, every observation having non-empty
  headline/body). Extends `TrustBadge.test.tsx` with 7 new cases
  covering: flag OFF hides toggle + body, flag ON renders
  collapsed toggle with `aria-expanded="false"`, click expands
  the body with the exact observation ids for a 4-source + known
  model input, degraded input (undefined citations, no model)
  renders `retrieval-none` + `model-unknown`, second click
  collapses, popover close → re-open starts collapsed, and the
  "zero telemetry from the toggle" invariant.

### DoD

- [x] Every Trust Badge popover now offers an honest
      "Why this answer?" disclosure that explains the retrieval
      signal strength and the model provenance in plain English.
- [x] The disclosure never contradicts the trigger pill —
      shared thresholds guarantee the retrieval bucket at 0 / 1-3 /
      4+ produces the matching observation.
- [x] Kill-switch (`?ff_trustBadgeReasoning=0` or
      `localStorage['ff.trust_badge_reasoning'] = '0'`) restores
      the T-TR1.3 popover pixel-for-pixel.
- [x] Re-opening the popover always starts with the disclosure
      collapsed; users never see stale expanded state from a
      previous click.
- [x] Zero new telemetry. `trust_badge_opened` (T-TR1) remains
      the only engagement signal for this popover.
- [x] `n=1` source renders "1 retrieved source" (singular), not
      "1 retrieved sources" — explicit regression test.

### Deliberately out of scope

- Streaming / persisting the model's chain-of-thought. That is
  the full T-TR2 heavyweight ticket and requires a backend
  plumb-through we are not ready to commit to.
- Per-observation telemetry (e.g. "user expanded retrieval-none").
  `trust_badge_opened` already answers the product question; a
  per-toggle event would cost a RODO review for marginal
  dashboard value.
- Localising the snippet. All strings are English-only for now,
  matching the rest of the Chat V9 trust + admin surfaces. A
  localisation pass lands with the broader i18n ticket.
- A "show me the retrieved sources text" affordance. That is the
  reasoning-reveal work; we explicitly want to avoid promising
  things we cannot deliver in this slice.
- Persisting the expanded/collapsed state across popover reopens.
  The snippet is short; forcing a fresh start on each open keeps
  the UI predictable and avoids the "why is this suddenly
  expanded" bug class.

---

<a id="t-tr1-4"></a>

## T-TR1.4

**Trust Badge · "Copy reasoning" button.** T-TR1.3 shipped a
`Copy` button in the popover footer that exports the retrieved
source list to a deterministic Markdown blob for pasting into a
Notion page, JIRA ticket, or Slack thread. T-TR2 then added the
"Why this answer?" disclosure with three closed-enum observations
(retrieval signal, model provenance, "Always verify" reminder)
derived from exactly the same `(citationCount, modelLabel)` pair
the trigger pill uses. Those observations are product-grade
copy we want quoted *verbatim* in hand-offs — PMs paste them
into review docs, support reps quote them in escalation tickets
— but T-TR1.3 only exported the citations, not the reasoning.
This ticket mirrors T-TR1.3 for the reasoning body.

### Delivered

- `src/utils/buildTrustBadgeReasoningText.ts` — pure formatter
  modelled on `buildTrustBadgeCitationsText`. Given a list of
  `TrustReasoningObservation`s and an optional humanised model
  label, produces:

  ```
  Why this answer? (answered by GPT-4o):

  1. Grounded in retrieved sources — The reply is grounded in 4 retrieved sources (see list above).
  2. Model used — Generated by GPT-4o.
  3. Always verify — Retrieval tells you what the model saw, not whether it is correct. Double-check anything that affects a decision.
  ```

  Renumbering is by *output* position so a filtered observation
  never leaves a numbering gap on the clipboard. An empty or
  fully-filtered list degrades to a graceful `"No reasoning
  recorded."` stub under the header so nothing ever lands
  silently on the clipboard.
- `src/utils/trustBadgeCopyReasoningFlag.ts` — kill-switch flag
  (`ff.trust_badge_copy_reasoning`, default ON) with the
  standard URL / `localStorage` / `import.meta.env` resolution
  order shared with every other Chat V9 flag.
- `src/components/AIChat/TrustBadge.tsx` — renders a second
  `Copy` button *inside* the T-TR2 disclosure body, visible only
  when the disclosure is expanded AND the new kill-switch is ON.
  Button shares the `writeToClipboard` seam with T-TR1.3 (so
  the same Clipboard API fallback applies) and drives its own
  `idle → copied → idle` / `idle → failed → idle` transition
  through an independent feedback state + timer, so the two copy
  buttons never clobber each other. Closing the popover and the
  unmount cleanup both clear the new timer defensively.
- `src/utils/chatV9FeatureFlags.ts` — registry entry for the new
  flag (`trust-badge-copy-reasoning`, ticket `T-TR1.4`, block
  `trust`) so AG1 v1 admins see it in the flags panel alongside
  T-TR1.3.
- `src/utils/__tests__/buildTrustBadgeReasoningText.test.ts` —
  9 cases pinning the exact clipboard payload: default header,
  humanised-label header, invalid label fallbacks, empty / null
  / non-array inputs, whitespace headline/body skipping,
  renumber-by-output-position, and all-filtered stub.
- `src/components/AIChat/__tests__/TrustBadge.test.tsx` — 10 new
  `T-TR1.4:` cases covering: kill-switch OFF hides the button,
  disclosure collapsed hides the button, both flags ON renders
  the button inside the disclosure body, Markdown payload
  content + humanised-label suffix, `answered by` omitted when
  humanizer OFF, `copied` / `failed` / throw transitions,
  feedback stays independent from the citations copy button,
  popover close resets feedback, and zero telemetry.

### DoD

- [x] Every Trust Badge popover with the reasoning disclosure
      expanded now offers a one-click `Copy` affordance that
      serialises the exact observations the user is reading to
      the system clipboard.
- [x] Clipboard payload never contradicts the popover — the
      button copies the same `buildTrustBadgeReasoning` output
      the disclosure renders.
- [x] Kill-switch (`?ff_trustBadgeCopyReasoning=0` or
      `localStorage['ff.trust_badge_copy_reasoning'] = '0'`)
      removes the button entirely and restores the T-TR2 body
      pixel-for-pixel.
- [x] The new button is independent of T-TR1.3: the two copy
      buttons share tone scheme but each has its own feedback
      state + timer, so a rapid back-to-back click sequence
      never shows stale feedback on the wrong button.
- [x] Re-opening the popover always starts with both copy
      buttons in the `idle` state.
- [x] Zero new telemetry. `trust_badge_opened` (T-TR1) remains
      the only engagement signal for this popover.

### Deliberately out of scope

- A "Copy everything" button that merges citations + reasoning
  in a single payload. Users who want both press both buttons;
  merging is easy to build later but hard to undo if users
  decide the combined block is too noisy.
- Telemetry on `Copy reasoning` click. AG1 v1 already reports
  flag overrides so ops can see the feature flip; per-click
  engagement has no product question attached to it.
- Localisation. The payload strings are English-only, matching
  T-TR1.3 and the rest of Chat V9's English-first trust
  surfaces. A localisation pass lands with the broader i18n
  ticket.
- Re-humanising the model label inside the payload. The caller
  passes the already-humanised label from T-TR1.2 so this
  helper stays orthogonal to the dictionary.
- Persisting clipboard success across popover reopens. The
  feedback window is transient by design; users who want a
  record should paste, not stare at the button.

---

## T-TR3-lite

**Trust badge per-citation clickable link.** Before this pass the
Trust Badge popover listed citation titles as plain text — even
when the citation carried a `link` field. Auditing a source meant
copying the title, pasting it into a search engine, and hoping
the first result was the one the model cited. That rewards
sceptical users with friction exactly when we want to reward them
with confidence. T-TR3-lite turns each cited title into a
standard "open in a new tab" external link, but only when the URL
passes a conservative sanitiser — so the popover never becomes an
XSS vector through a stray `javascript:` or `data:` citation
coming back from a flaky retrieval pipeline.

### Delivered

- `src/utils/isSafeCitationLink.ts` — pure sanitiser. Accepts
  only `http:` / `https:` absolute URLs with a non-empty host,
  rejects `javascript:` / `data:` / `vbscript:` / `file:` /
  `about:` / `blob:` (case-insensitive, trims leading whitespace
  defensively), `mailto:` / `tel:`, protocol-relative URLs, and
  relative paths. Returns the URL constructor's canonical form so
  `<a href>` consumers see a stable string for the same input.
- `src/utils/__tests__/isSafeCitationLink.test.ts` — 17 cases
  pinning every accept / reject decision (scheme coverage,
  mixed-case bypass attempts, whitespace padding, malformed
  input, canonicalisation).
- `src/utils/trustBadgeCitationLinksFlag.ts` — kill-switch
  (`ff.trust_badge_citation_links`, default ON). URL query wins
  over `localStorage` wins over env var wins over default, same
  precedence as every other Chat V9 flag.
- `src/components/AIChat/TrustBadge.tsx` — the source list inside
  the popover now wraps each title in an `<a target="_blank"
  rel="noopener noreferrer">` when both (a) the kill-switch is ON
  and (b) the citation's `link` passes the sanitiser. Rows that
  fail either gate keep the pre-T-TR3-lite plain-text look via a
  `trust-badge-citation-plain-{idx}` span. The anchor carries an
  `aria-label` of `Open source in a new tab: <title>` so screen
  readers announce the navigation intent, not just "link".
  Numeric prefix, title, tooltip, and truncation behaviour are
  untouched.
- `src/utils/chatV9FeatureFlags.ts` — registered the new flag
  (`trust-badge-citation-links`, ticket `T-TR3`, block `trust`).
- `src/components/AIChat/__tests__/TrustBadge.test.tsx` — 8 new
  `T-TR3-lite:` cases covering: kill-switch OFF always renders
  plain text, missing `link` renders plain text, `javascript:`
  renders plain text, safe https renders `<a>` with correct
  `href` / `target` / `rel`, `aria-label` includes the title,
  mixed rows in the same popover (link/plain/plain/link), URL
  canonicalisation (uppercase host lowercased), and zero
  telemetry from clicking a link.

### DoD

- [x] Every Trust Badge popover row with a valid http/https
      `link` now opens the source in a new tab with the chat
      surface intact (`rel="noopener noreferrer"` blocks the new
      tab from steering the chat tab via `window.opener`).
- [x] Citation rows without a usable link render identically to
      the pre-T-TR3-lite UI. No empty `<a>`, no "dead" underline.
- [x] Kill-switch (`?ff_trustBadgeCitationLinks=0` or
      `localStorage['ff.trust_badge_citation_links'] = '0'`)
      removes every `<a>` from the popover pixel-for-pixel; rows
      collapse back to the plain-text layout even when their
      `link` is otherwise valid.
- [x] `isSafeCitationLink` rejects every scheme outside
      http/https, including case-mutated and whitespace-padded
      `javascript:` variants. Sanitiser has an independent test
      suite so the accept/reject contract is auditable without
      opening the component.
- [x] Screen reader announcement for each linkified row includes
      the citation title, not just the URL, so the popover stays
      readable in a scan.
- [x] No new telemetry. `trust_badge_opened` (T-TR1) remains the
      only engagement signal attached to this popover.

### Deliberately out of scope

- Inline excerpt preview on hover. The Trust Badge popover is a
  `sources list`, not a `source reader`. A hover excerpt would
  either repeat the existing CitationList below the message or
  add a second tooltip layer inside the popover; both feel worse
  than delegating to the full citation card once the user clicks
  through.
- Copying the link on shift-click or middle-click. Browsers
  already ship these interactions for any `<a>`; we don't need
  custom handlers.
- Linkifying the overflow "… and N more" row. The overflow hint
  is an invitation to scroll the list below the message, not an
  individual source — a link there would point to nothing.
- Rewriting backend-returned URLs (e.g. forcing https, stripping
  tracking params). The sanitiser's job is accept-or-reject, not
  transform. A URL the backend asked us to cite is cited
  verbatim once it passes the scheme check.
- Telemetry on citation clicks. Useful for a future retrieval
  quality dashboard, but intentionally deferred until we have
  the dashboard to consume the signal — a pre-instrumentation
  pass only adds PII surface without product value.

<a id="t-tr34"></a>

<a id="t-tr34"></a>

## T-TR3.4 — Trust badge citation row · domain pill

**Status:** ✅ Shipped (2026-04-18, wave M1)

**Why now.** T-TR3-lite made citation titles clickable when the source
URL passes our sanitiser, but users still have to hover over the link
(or click through) to learn *where* the citation comes from. Two
citations titled "Quarterly outlook" and "Quarterly outlook" look
identical until you discover one is from `reuters.com` and the other
from `reddit.com`. Surfacing the hostname inline turns the source-domain
decision into a 0.1-second glance and — crucially — stays useful on
tenants that keep citations non-interactive (where T-TR3-lite is OFF).

**Behaviour.**

- Extract the hostname of each `citation.link` through the new pure
  helper `extractCitationDomain()`; accept `http:` and `https:` only,
  reject `javascript:` / `data:` / `vbscript:` / `file:` / `about:` /
  `blob:`, and strip a leading `www.` so `www.nytimes.com` and
  `nytimes.com` de-duplicate visually.
- Render a small secondary pill inside each `<li>` after the citation
  title: `<span data-testid="trust-badge-citation-domain-{idx}"
  data-citation-domain="…">· {domain}</span>`. The middle-dot separator
  is `aria-hidden="true"`; the pill itself carries an `aria-label` of
  `Source domain: {domain}` so screen readers announce provenance
  explicitly instead of reading the glyph.
- **Orthogonal to T-TR3-lite.** The domain pill is a provenance signal,
  not a navigation control; when the citation-links flag is OFF and the
  title renders as plain text, the domain pill still appears next to
  it. Tenants that must stay non-interactive get the same "where's this
  from?" cue as tenants with links enabled.
- Silently degrades: citations without a link, with malformed URLs, or
  with any non-http(s) scheme render NO pill (not an empty one, not a
  placeholder). The popover layout is pixel-identical to the pre-T-TR3.4
  build when every row fails the extraction.
- **Dual kill-switches.** `ff.trust_badge_citation_domain` (this ticket)
  OR `ff.trust_badge` (the parent T-TR1 kill-switch) OFF removes every
  pill. Flipping T-TR3-lite has no effect on this feature.

**Delivered files.**

- `src/utils/extractCitationDomain.ts` (NEW) — pure helper. Canonicalises
  through `new URL()` (same pattern the T-TR3-lite sanitiser uses), then
  lowercases + strips the bare `www.` prefix. Dependency-free, directly
  unit-testable.
- `src/utils/trustBadgeCitationDomainFlag.ts` (NEW) — standard resolver
  + `TRUST_BADGE_CITATION_DOMAIN_FLAG_KEYS` (URL ▸ localStorage ▸ env ▸
  default ON).
- `src/utils/chatV9FeatureFlags.ts` — registered as
  `trust-badge-citation-domain` (ticket `T-TR3.4`, block `trust`).
- `src/components/AIChat/TrustBadge.tsx` — new `isCitationDomainEnabled`
  prop seam, `citationDomainEnabled` derived boolean, and the pill JSX
  appended to each `<li>` alongside the existing T-TR3-lite title. The
  computation runs per-row and only touches `c.link`, so rows whose link
  is unsafe add no extra DOM.
- `src/utils/__tests__/extractCitationDomain.test.ts` (NEW) — 18 cases
  pinning accept / reject decisions (all 6 dangerous protocol prefixes,
  case-insensitivity, whitespace trimming, `www.` stripping, preservation
  of `www1.`, port / query / fragment discards, non-http(s) rejection,
  malformed-URL rejection).
- `src/components/AIChat/__tests__/TrustBadge.test.tsx` — 9 new
  `T-TR3.4:` cases covering: kill-switch OFF removes every pill, safe
  link + flag ON renders pill with `data-citation-domain`, `www.` is
  stripped, missing link → no pill, dangerous protocol → no pill,
  orthogonality to T-TR3-lite (works with links OFF), aria-label
  announces the domain, mixed safe / unsafe / missing rows don't
  cross-talk, and no telemetry emission.

### DoD

- [x] Every citation row with a safe http(s) link shows a domain pill
      announcing the hostname (stripped of `www.`).
- [x] Citations with missing / unsafe / non-http(s) links render NO
      pill; no empty span, no placeholder text, no broken layout.
- [x] Kill-switch `?ff_trustBadgeCitationDomain=0` (or
      `localStorage['ff.trust_badge_citation_domain'] = '0'`) removes
      every pill; layout matches pre-T-TR3.4 pixel-for-pixel.
- [x] Flipping T-TR3-lite has no effect on this feature — the domain
      pill is independent provenance, not an extension of the link.
- [x] `extractCitationDomain` has an independent unit-test suite so the
      accept/reject contract is auditable without opening the component.
- [x] Screen readers announce `Source domain: {domain}` via
      `aria-label`; the visible middle-dot glyph is `aria-hidden`.
- [x] Zero new telemetry.

### Deliberately out of scope

- **Favicon rendering.** Would require an external image fetch per
  citation, introduce request-timing SSRF considerations, and open a
  CSP conversation. The textual hostname is enough provenance for a
  glance.
- **Click-to-filter by domain.** The popover is a source list, not a
  search surface; making the pill clickable would steal focus from the
  linkified title and confuse the primary affordance.
- **Colour-coding trusted vs untrusted domains.** Allow-listing is a
  tenant-policy question, not a Trust Badge one; a blanket palette
  would either embarrass or reassure by accident.
- **`tld.co.uk`-style public-suffix aware shortening.** `extractCitationDomain`
  returns the full hostname after `www.` stripping — `gov.uk` pages show
  `gov.uk`, `bbc.co.uk` shows `bbc.co.uk`. Public-suffix logic would
  need the `tldts` library (+~50 KB) for a gain no user has asked for.
- **Copying the domain.** Users already have the full URL in the
  clickable link (T-TR3-lite) and in the AG1 v1.2 copy-citations
  clipboard payload (T-TR1.3); a third copy affordance would fragment
  the workflow.
- **Telemetry on domain-pill renders.** Useful for a future retrieval
  quality dashboard, deferred with T-TR3-lite click telemetry so both
  land together once the dashboard exists.
