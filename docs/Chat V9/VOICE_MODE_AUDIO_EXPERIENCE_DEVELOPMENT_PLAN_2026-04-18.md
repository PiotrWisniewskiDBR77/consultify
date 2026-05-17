# Chat V9 / VOICE — development plan (2026-04-18)

> **Scope note:** this plan documents the voice tickets that are actually
> shipped on `develop`. The broader VM1–VM10 roadmap exists as design
> material elsewhere; here we only track what has a live code + test
> + flag set on this branch.

> **Cross-refs**
> - Kill-switches & incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new voice feature → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md)

## Shipped

| ID | Title | Effort | Priority | Risk | Status |
|---|---|---|---|---|---|
| [VM3](#vm3) | Voice modes legend popover | 0.5 d | P0 | low | ✅ |
| [VM3.1](#vm3-1) | Voice modes legend keyboard shortcut | 0.25 d | P1 | very low | ✅ |
| [VM3.2](#vm3-2) | Voice legend · "Copy legend" button | 0.25 d | P2 | very low | ✅ |
| [VM4](#vm4) | Barge-in acknowledgement toast | 0.5 d | P0 | low | ✅ |
| [VM10](#vm10) | Voice funnel telemetry | 1.5 d | P1 | low | ✅ |
| [VM1-lite](#vm1-lite) | "Voice unavailable" fallback row in VM3 legend | 0.25 d | P1 | low | ✅ |

---

## VM3

**Legenda: rozmowa vs dyktacja.** A small `?` button next to the mic
opens a popover explaining the two mic modes the UI exposes today.

### Delivered

- `src/components/AIChat/VoiceModeLegend.tsx` — popover with two rows:
  **Dictation** (fills input; user sends) and **Conversation (live)**
  (continuous turn-based).
- Wired into `EnhancedChatInput.tsx` immediately before the mic cluster.
- Close-on-Escape + close-on-outside-click.
- Flag: `ff.voice_mode_legend` (default ON). When off, the trigger
  button is hidden entirely; the mic cluster is unaffected.
- Telemetry: `voice_mode_legend_opened` — one event per open gesture.
- Tests: 8 passing — render gate, open/close toggle, telemetry dedupe,
  Escape, outside-click, telemetry-throws-gracefully.

### DoD

- [x] User can discover what the mic does without clicking it first.
- [x] Copy is honest about the two modes that actually exist (no
      Realtime / Dictation / Hybrid triplet promised).
- [x] Kill-switch verified with `?ff_voiceModeLegend=0`.

---

<a id="vm3-1"></a>

## VM3.1

**Voice modes legend keyboard shortcut.** VM3 shipped the `?` help
button inside `EnhancedChatInput`. It's discoverable once the input
is focused, but keyboard-first users who want to recheck "what does
live mode do again?" mid-conversation have to hunt for it. This
ticket adds a single global chord — Alt+Shift+V (Option+Shift+V on
macOS) — that tells every mounted `VoiceModeLegend` to open its
popover. Paired with NAV-M1.1 (Alt+Shift+C → back to chat) it starts
a consistent Alt+Shift+&lt;letter&gt; family: easy to teach, trivially
extensible.

### Delivered

- `src/components/AIChat/VoiceLegendShortcut.tsx` — headless React
  component mounted once at the App root. Attaches a global
  `keydown` listener that matches Alt+Shift+V (using `event.code`
  fallback so macOS's Option+V → "√" glyph still resolves), and
  dispatches a `chat-v9-voice-legend:open` CustomEvent. Short-
  circuits when focus is in an editable element (INPUT / TEXTAREA /
  SELECT / contenteditable) or when any `aria-modal="true"` is in
  the tree so the chord never hijacks typing or stomps on a
  confirm dialog. Lone "v" / Ctrl+V (paste) / Cmd+V never match.
  Returns null.
- `src/components/AIChat/VoiceModeLegend.tsx` — new `useEffect`
  listens for the open event and calls the same `handleOpen()` the
  click path uses. The component's own `isEnabled()` gate still
  applies at the moment of fire: a disabled VM3 flag keeps the
  popover closed even if the shortcut fires the event.
- `src/utils/voiceLegendShortcutFlag.ts` — `ff.voice_legend_shortcut`
  (default ON) with the standard URL → localStorage → env →
  default resolution. Exports `VOICE_LEGEND_OPEN_EVENT` so the
  component and the shortcut share a single source of truth for
  the event name.
- `src/App.tsx` — mounts `<VoiceLegendShortcut />` at the global
  root right after `BackToChatShortcut`, so both chords share the
  same lifecycle and ordering discipline.
- Telemetry: new event `voice_mode_legend_shortcut` emitted before
  the CustomEvent dispatch. Payload is empty, symmetric with the
  existing `voice_mode_legend_opened` event. The split lets us
  measure what fraction of users learn the chord vs. click the
  button without spreading a `trigger` field onto the original
  event. Shortcut-triggered opens ALSO emit
  `voice_mode_legend_opened` (the legend's own handler fires on
  the CustomEvent), so total "legend opened" counts stay
  conservation-of-mass correct.
- `src/utils/chatV9FeatureFlags.ts` — registers
  `voice-legend-shortcut` (ticket `VM3.1`, block `voice`,
  `testId: null`).
- Tests: `VoiceLegendShortcut.test.tsx` — 18 cases covering the
  matcher (alt+shift+v, uppercase, `event.code` fallback, missing
  modifiers, Ctrl/Meta blockers, lone "v"), editable-target /
  open-modal guards, flag OFF no-op, happy path with default-
  prevented + telemetry + dispatch, telemetry throw resilience,
  and unmount listener removal. Extends `VoiceModeLegend.test.tsx`
  with 4 new cases for the CustomEvent listener (opens on event,
  fires `voice_mode_legend_opened`, ignores event when legend
  flag is OFF, clean unmount).

### DoD

- [x] Keyboard-first users can open the voice-modes legend from
      anywhere in the app without touching the mouse.
- [x] Kill-switch (`?ff_voiceLegendShortcut=0` or
      `localStorage['ff.voice_legend_shortcut'] = '0'`) detaches
      the listener entirely — the `?` button keeps working.
- [x] Listener never hijacks typing (editable-target guard) and
      never stomps on a confirm dialog (open-modal guard).
- [x] Telemetry contract unchanged for VM3; new
      `voice_mode_legend_shortcut` event carries empty payload.

### Deliberately out of scope

- Advertising the chord inside the popover itself (e.g. "press
  Alt+Shift+V to open this again"). The chord is a progressive
  disclosure — users who learn it win, the rest still click. A
  visible hint raises the bar on accessibility copy (macOS glyph
  vs Windows label) for marginal value; revisit when we have
  telemetry showing discovery matters.
- Configurable chord. Collision risk is real, but so is
  fragmentation; defer until we have a second complaint.
- Using a global command palette. Out of scope for this ticket;
  see the broader M2 navigation work.

---

<a id="vm3-2"></a>

<a id="vm3-2"></a>

## VM3.2

**Voice legend · "Copy legend" button.** VM3 ships the popover,
VM3.1 ships the keyboard shortcut to open it from anywhere. The
remaining gap is **portability**: if an admin walks a user
through voice modes over Slack, or drafts onboarding copy in
Notion, they currently screenshot the popover. VM3.2 adds the
one affordance that fixes that end-to-end: a small `Copy` button
in the popover footer that writes a Markdown-ish payload of the
exact content the popover is showing (two-mode OR VM1-lite
"voice is unavailable") to the clipboard. Paste-friendly, no
telemetry.

### Delivered

- `src/utils/buildVoiceLegendCopyText.ts` — pure, dependency-free
  formatter. Produces a header (`<title>:` on its own line)
  followed by either `- <mode-title> — <mode-body>` bullets or a
  single `<unavailable-title>. <unavailable-body>` sentence. The
  `unavailable` layout takes precedence when provided so the
  clipboard payload always matches whichever layout the popover
  is showing. Empty / whitespace-only fields are skipped; if
  every field is filtered out the helper degrades to `<header>
  + "No content recorded."` so nothing lands silently.
- `src/utils/voiceLegendCopyTextFlag.ts` — standard resolver
  (`ff.voice_legend_copy_text`, URL ▸ localStorage ▸ env ▸
  default-ON) + `VOICE_LEGEND_COPY_TEXT_FLAG_KEYS`.
- `src/utils/chatV9FeatureFlags.ts` — registered as
  `voice-legend-copy-text` (ticket `VM3.2`, block `voice`,
  `testId: 'voice-mode-legend-copy'`, `specDocs` pointing at
  this anchor).
- `src/components/AIChat/VoiceModeLegend.tsx` — new
  `isCopyTextEnabled` + `writeToClipboard` test seams, a
  `copyFeedback` state machine (`idle → copied → idle` or
  `idle → failed → idle` with a 2 s window), a
  `handleCopyLegend` callback that builds the payload from the
  same translated strings the popover renders, and a new footer
  `<div>` housing the `Copy` button (replaced by `Copied` or
  `Failed` during the feedback window). The button never fires
  telemetry — `voice_mode_legend_opened` already captures intent.
- `src/utils/__tests__/buildVoiceLegendCopyText.test.ts` — 13
  new cases pinning header rendering, two-mode bullet layout,
  unavailable single-sentence layout, terminal-punctuation
  handling on the unavailable title, `unavailable` precedence
  over `modes`, empty-field filtering on both layouts, the
  "No content recorded." stub, and determinism.
- `src/components/AIChat/__tests__/VoiceModeLegend.test.tsx` —
  10 new `VM3.2 copy-legend button` cases covering: button
  renders iff the VM3.2 kill-switch is ON (with the VM3 flag
  also ON), kill-switch OFF hides the
  button, two-mode payload content, unavailable-layout payload
  content, `idle → copied → idle` transition with fake timers,
  async-resolved failure transition, thrown-writer failure
  transition, feedback reset on popover close, telemetry-free
  click, and distinct `aria-label` strings across states.

### DoD

- [x] Power users can paste the voice-mode explanation into a
      Notion / Slack / JIRA message without opening DevTools or
      screenshotting the popover.
- [x] The clipboard payload never lies: the button mirrors
      whichever layout (two-mode / VM1-lite) the popover is
      currently rendering.
- [x] Kill-switch (`?ff_voiceLegendCopyText=0` or
      `localStorage['ff.voice_legend_copy_text'] = '0'`) removes
      the button and its handler; popover layout matches the
      pre-VM3.2 build pixel-for-pixel.
- [x] Transient feedback has a bounded 2 s window and resets on
      popover close so the next open starts clean.
- [x] No new telemetry events. The existing
      `voice_mode_legend_opened` already signals intent.

### Deliberately out of scope

- **Dedicated telemetry event for copy-click.** Whether the user
  copies after reading is a refinement; start by observing open
  rate. Adding a second event now would create a
  compare-to-open-rate analysis we don't have a dashboard for.
- **Richer Markdown (table, bold per-field).** Notion, Slack, and
  plain text all render the current shape reasonably; a table
  would Markdownify well in Notion but fall apart in Slack.
  Keep the lowest-common-denominator.
- **"Copy as JSON" button.** Nice for devs but zero users have
  asked for it; add on feedback, not speculation.
- **Persistent "copied in this session" badge.** We reset per
  open on purpose: each open is a fresh "I want this explanation
  now" flow, and a stale badge would make the affordance feel
  like it already happened.

---

<a id="vm4"></a>

## VM4

**Barge-in acknowledgement toast.** When the user mutes TTS
mid-playback, a short toast confirms the interrupt landed.

### Delivered

- `src/utils/bargeInToast.ts` — `notifyBargeIn()` helper with a
  **1.5 s debounce** (spec DoD: "Nie spamuje przy wielokrotnych
  przerwach"). `lastShownAt` is initialised to
  `Number.NEGATIVE_INFINITY` so the first call is never inside the
  window regardless of `Date.now()`.
- `src/utils/bargeInToastFlag.ts` — `ff.barge_in_toast` flag (default
  ON). When off, `notifyBargeIn()` is a no-op; `stopSpeaking()` behaves
  unchanged.
- `src/components/AIChat/UnifiedChatPanel.tsx` — mute button snapshots
  `voiceState.isSpeaking` BEFORE calling `stopSpeaking()` so the toast
  only fires on a real interrupt, not a plain mute toggle.
- Telemetry: `voice_barge_in_notified` with closed-enum `source`.
  Drops inside the debounce window do **not** emit — visible toasts
  only.
- Tests: 7 passing — on/off paths, debounce drop, re-fire after window,
  default source, graceful toast failure, debounce slot still used when
  toast throws (anti-spam guarantee).

### DoD

- [x] Toast copy is short, non-blocking, and single-toast-id so a
      hammered mute does not stack banners.
- [x] Debounce is proven by test, not wishful thinking.
- [x] Kill-switch verified with `?ff_bargeInToast=0`.

---

## VM10

**Voice funnel telemetry.** Emit `voice_start`, `voice_stt_success`,
`voice_stt_fail`, `tts_on` from `useUniversalVoice` with closed-enum
payloads. Pairs with VM4's `voice_barge_in_notified` for the full voice
funnel.

### Delivered

- `src/utils/voiceFunnelTelemetry.ts` — typed emit helpers with
  `bucketTranscriptLength` (never the text itself), `VoiceSttFailReason`
  closed enum, and a `safeTrack()` wrapper that swallows analytics
  failures so voice stays alive.
- `src/utils/voiceFunnelTelemetryFlag.ts` — `ff.voice_funnel_telemetry`
  (default ON). One switch covers all four events.
- `src/hooks/useUniversalVoice.ts` — five call sites:
  - `startListening()` → `voice_start` (once per idle → listening,
    duplicate calls guarded).
  - Whisper `onstop` success → `voice_stt_success`; error →
    `voice_stt_fail` (`network` for TypeError, `server_error`
    otherwise).
  - `getUserMedia` catch → `voice_stt_fail:permission_denied` for
    `NotAllowedError` / `NotFoundError`.
  - Web Speech `onresult` final → `voice_stt_success`; `onerror` maps
    the spec's closed enum (`no-speech`, `not-allowed`, `network`,
    `aborted`) to our `VoiceSttFailReason`.
  - `speak()` → `tts_on` fires **before** the provider fetch so user
    intent is counted even if the backend rejects.
- `src/services/funnelAnalytics.ts` — four event names added to
  `FunnelEventName` with inline PII contract comments.
- Tests: 11 passing — all four helpers emit on/off, sink-throws is
  swallowed, `bucketTranscriptLength` never leaks text (PII regression
  test freezes the closed-enum return contract).

### DoD

- [x] RODO-safe: no transcript content, no audio, no raw error
      strings. Confirmed by regression test.
- [x] One flag kills the whole funnel without touching voice runtime.
- [x] Event contract documented — see
      [telemetry contract](./CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md).

### Deliberately out of scope

- `voice_to_module_nav` (per spec: "opcjonalnie") — needs a routing
  hook that does not exist on this branch.
- Dashboard / query-layer wiring — that is a data-team task, not a code
  ticket. This plan guarantees the events land cleanly; dashboards
  consume them downstream.

---

## VM1-lite

**"Voice unavailable" fallback row inside the VM3 legend.** An unsupported
browser already hides the mic button in `EnhancedChatInput` — the legend
trigger is the only remaining surface where the user can learn *why*
they have no mic. This extension turns that silent failure into an
explicit "your browser cannot do this" message.

### Delivered

- `src/components/AIChat/VoiceModeLegend.tsx` — new `unavailable?: boolean`
  prop. When true, the popover replaces the two-mode list with a single
  amber-accented row: "Voice is unavailable in this browser" + a concrete
  remediation hint (desktop Chrome/Edge, iOS 15+ Safari, site must be
  allowed for mic access).
- `src/components/AIChat/EnhancedChatInput.tsx` — passes
  `unavailable={!speechSupported && teresaVoiceStatus !== 'live' &&
  teresaVoiceStatus !== 'connecting'}`. On supported browsers and during
  active Teresa sessions the prop is false, so the legend renders
  unchanged.
- Telemetry: `voice_mode_legend_opened` still fires in unavailable mode —
  each open is a distinct "help, my mic doesn't work" signal, valuable
  independent of the reason.
- Tests: 3 new cases (unavailable row renders, normal rows hidden,
  telemetry still fires, falsy `unavailable` restores defaults). Total
  VM3 suite: 11/11.

### DoD

- [x] Unsupported browsers show a concrete, actionable message instead
      of a legend that promises features they cannot access.
- [x] Supported browsers see identical VM3 behaviour — no regression.
- [x] No new flag introduced. Relies on the existing `voice-mode-legend`
      kill-switch: if the legend is off, the unavailable notice is off
      too.

### Deliberately out of scope

- Runtime probing of voice capability inside the component. Detection
  stays where it already lives (`EnhancedChatInput.tsx`); the legend
  only renders what it is told.
- A dedicated `voice_unavailable_surfaced` event. The combination of
  `voice_mode_legend_opened` + a user-agent dimension on the host
  dashboard is sufficient; adding a second event would be redundant.
