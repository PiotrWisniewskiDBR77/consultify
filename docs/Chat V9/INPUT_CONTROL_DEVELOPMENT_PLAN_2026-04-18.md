# INPUT / CONTROL — development plan (develop branch, 2026-04-18)

Honest plan: only features whose code has actually landed on `develop`
are documented here. See `README.md` in this folder for the project-wide
index.

> **Cross-refs**
> - Kill-switches & incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new input feature → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md)

## Scope

The INPUT block in the original audit covered the user's ability to
steer the AI *before* pressing Send — which model will answer, what
focus mode is active, which tools are enabled, whether private mode
is on. Several of those signals already have surfaces (`ModelSelector`
dropdown, `FocusModeSelector`, `PrivateModeDetails` badge) but they
are distributed across menus and modals. A user who changes a model
and returns to the input loses sight of *which* model is active until
the next reply arrives carrying the Trust Badge.

This plan closes the **retrospective → prospective signal asymmetry**:
Trust Badge tells the user what *did* run, the next-model chip tells
them what *will* run.

## Shipped

<a id="c-in1"></a>

### C-IN1 · Next-message model hint chip

- **Effort**: XS
- **Priority**: P1 (symmetry with shipped T-TR1 Trust Badge)
- **Risk**: very low — read-only, zero network, zero telemetry
- **Status**: ✅ shipped
- **Flag**: `next-model-chip` (`ff_nextModelChip=1|0`), default ON

What landed:

- `src/utils/nextModelChipFlag.ts` — standard resolver helper,
  URL > localStorage > env > default ON.
- `src/components/AIChat/NextModelChip.tsx` — a compact pill rendered
  in `EnhancedChatInput`'s left action bar (after `CoThinkerMenu`).
  The chip displays `"→ <model>"` where `<model>` resolves from
  `currentUser.aiConfig` in this order:
  1. Match `selectedModelId` / `modelId` against
     `aiConfig.privateModels` → use the private entry's `name`.
  2. Fall back to `selectedModelId ?? modelId`.
  3. If the id looks like a UUID (e.g. a system provider row id),
     display `"Default model"` — a UUID would truncate to gibberish.
  4. Truncate to 22 characters with a trailing ellipsis.
- `NextModelChip` returns `null` when no model id is resolvable or
  when the flag is off. The action bar collapses cleanly.
- Exports `resolveNextModelLabel(aiConfig)` as a pure helper so the
  truncation / UUID heuristics are unit-testable without rendering.
- Registered in `CHAT_V9_FLAGS` under block `input` with ticket
  `C-IN1`, `testId = 'next-model-chip'`, `telemetry = []`.

### DoD

- When `currentUser.aiConfig.modelId === 'gpt-4o'`, the chip reads
  `"→ gpt-4o"` in every `EnhancedChatInput` instance.
- When the model id is a bare UUID, the chip reads `"→ Default model"`.
- When `aiConfig` has no resolvable model id, the chip returns `null`.
- When the feature flag is off (URL / localStorage / env), the chip
  returns `null` regardless of `aiConfig`.
- `ModelSelector` dropdown is untouched — it remains the only place
  to *change* the active model.

### Deliberately out of scope (v1)

- **Clickable chip that opens ModelSelector.** Wiring this requires
  exposing an imperative "open" handle on `ModelSelector` and would
  duplicate discovery paths. Keeping the chip passive means the
  component surface stays tiny and drift-free.
- **Per-provider icon / colour badge.** The chip is a text label only.
  Provider → colour mapping adds a maintenance burden every time a
  new provider lands; the existing `ModelSelector` row icons already
  answer the "which provider" question at change time.
- **Telemetry emit on render.** Would fire on every input mount /
  streaming update — extremely noisy for a passive display. User-
  initiated model switches are already covered by
  `ai_model_changed` in `UnifiedChatPanel`.

<a id="c-in2"></a>

### C-IN2 · Input character counter pill

- **Effort**: XS
- **Priority**: P2 (scale-of-send awareness; write-side sibling
  to C-IN1's read-side model hint)
- **Risk**: very low — read-only, no side effects, never blocks
  Send, zero telemetry
- **Status**: ✅ shipped
- **Flag**: `input-char-counter` (`ff_inputCharCounter=1|0`),
  default ON

What landed:

- `src/utils/inputCharCounterFlag.ts` — standard URL > localStorage
  > env > default ON resolver.
- `src/components/AIChat/InputCharCounter.tsx` — a compact
  `role="status" aria-live="polite"` pill that renders only when
  `value.length >= threshold`. Default threshold is 400
  characters (below that, 99% of sessions see no chrome). Default
  soft max is 8000 characters — intentionally conservative across
  every currently-shipped model. Both defaults are overridable via
  props.
- Colour escalates in three bands:
  - `slate` when `length < 80% * max` (normal long message)
  - `amber` when `80% * max <= length < max` (approaching cap)
  - `rose` when `length >= max` (over soft cap)
- Integrated in `EnhancedChatInput.tsx`'s left action bar, right
  after the Next-model chip, receiving the same `value` state the
  textarea reads / writes.
- Registered in `CHAT_V9_FLAGS` under block `input` with ticket
  `C-IN2`, `testId = 'input-char-counter'`, `telemetry = []`.

### DoD

- At `value.length < 400` → pill is absent; action bar looks
  identical to its pre-C-IN2 layout.
- At `value.length >= 400` and `< 6400` → pill visible in slate.
- At `6400 <= value.length < 8000` → pill shifts to amber.
- At `value.length >= 8000` → pill in rose; Send still works (no
  client-side hard cap added).
- Flag OFF → pill never mounts regardless of length.
- `aria-live="polite"` lets screen readers announce the counter
  on meaningful updates without flooding per keystroke.

### Deliberately out of scope (v1)

- **Per-model cap.** Models have different context windows; a
  reliable cap requires a round trip to the backend or a capability
  registry. This pill intentionally uses one soft max across models
  to avoid lying to users when the selected provider changes. When
  / if we add a `maxInputChars` field to `aiConfig`, the prop is
  already in place.
- **Token counting.** Characters are not tokens. A token counter
  would be more accurate for model-limit purposes but requires a
  tokenizer library. Out of scope until we have a concrete need.
- **Telemetry.** Render-time or keystroke-based emission would be
  extreme noise for a passive display. The existing send-success
  funnel is sufficient for "are messages too long?" analysis.

<a id="c-in4-lite"></a>

<a id="c-in4-lite"></a>

### C-IN4-lite · Input keyboard-hint strip

**Why.** Chat V9 kept the muscle-memory contract — Enter sends,
Shift+Enter adds a newline, Escape clears the draft — but
onboarding telemetry kept showing the same entry question:
"how do I add a paragraph break?". The answer is two keys, but
it is invisible in the UI. A 10-pixel hint strip underneath the
textarea closes that loop without adding a tutorial step.

**Behaviour.**

- Renders a single-line, low-contrast strip under the input
  action bar: `Enter ↲ send · Shift+Enter newline · Esc clear`.
- Each hint is a `<span>` containing a `<kbd>` (the chord) and
  a short action label; consecutive hints are joined by a dim
  middle-dot.
- `aria-hidden="true"` on the root so screen readers skip the
  copy — textareas already expose these affordances to assistive
  tech, and duplicating the announcement would be noise.
- Not keyboard-focusable, no click handlers, no callbacks. The
  strip is purely decorative.
- Kill-switch `ff.input_hint_strip` (default ON) collapses the
  component to `null` pixel-for-pixel. Accepts an optional
  `className` that is appended to the base classes so callers
  can align the strip with non-standard layouts without
  clobbering the typography.

**Delivered.**

- `consultify/src/components/AIChat/InputHintStrip.tsx` (NEW) —
  the strip component, with closed-list `HINTS` array so
  extending the hint set is a deliberate act.
- `consultify/src/utils/inputHintStripFlag.ts` (NEW) — standard
  Chat V9 resolver (URL → localStorage → env → default ON).
- `consultify/src/components/AIChat/EnhancedChatInput.tsx` —
  mounted at the root of the input wrapper, directly below the
  textarea shell, above the cloud-picker / move-to-project
  modals.
- `consultify/src/utils/chatV9FeatureFlags.ts` — registered as
  `input-hint-strip` (ticket `C-IN4`, block `input`).

**DoD.**

- [x] Strip renders under every `EnhancedChatInput` mount when
      the flag is ON.
- [x] Kill-switch OFF collapses the component to `null` and the
      parent layout is identical to pre-C-IN4-lite.
- [x] `aria-hidden="true"` is set on the root; the strip is not
      focusable.
- [x] Zero telemetry events fire. No callbacks, no store reads.
- [x] Unit tests cover: flag gate, render order, kbd + label
      per hint, separator count, a11y, optional className, and
      purity of mount.

**Deliberately out of scope.**

- **Localisation.** English only. Matches the rest of Chat V9's
  small surfaces (NAV-M2-lite, T-TR2).
- **Platform-aware key chord** (`⌘+Enter` vs `Ctrl+Enter`).
  Composing with Enter is universal on the web; platform
  modifier chords would require a capability probe that we do
  not need for a passive hint. Adding it later is a closed-list
  edit of `HINTS`.
- **Interactive "click to insert key" affordance.** The strip is
  decorative; turning it into a control would need focus, role,
  and announcement wiring that the textarea already owns.
- **Per-mode strips** (voice, dictation). The voice and dictation
  transcript rows already render their own status ribbon above
  the input; stacking a second strip would fight them.
- **Telemetry.** Render-time emission would be extreme noise for
  a passive display that the user does not interact with.

<a id="c-in6-lite"></a>

<a id="c-in6-lite"></a>

### C-IN6-lite · Input soft-limit inline toast (rose threshold nudge)

**Status:** ✅ Shipped (2026-04-18, wave M1)

**Why now.** The C-IN2 `InputCharCounter` turns *rose* once the textarea crosses the 8000-character soft cap. The pill is a passive signal — it's easy to miss mid-flow when the user is re-reading the message rather than the action bar. C-IN6-lite adds a single *active* nudge the first time the rising edge is crossed in a tab, with a "Don't show again this session" escape hatch modelled on T-PM2.1 so the nudge never becomes noise.

**Behaviour.**

- Mounts as a **headless sibling** of the counter inside the left action-bar cluster. Owns no DOM of its own; side-effects only (`toast.custom` + `sessionStorage` writes).
- Fires at most **once per browser tab**. Two independent gates enforce this:
  - `chatV9.inputSoftLimitToastFiredForSession = '1'` sentinel → silences the toast even across remounts within the same tab.
  - `firedThisMountRef` → silences the toast within the same mount even if the sentinel write failed (private-mode browsers, quota).
- Detector is rising-edge only (`prev < max && curr >= max`), so sustained over-limit composition does not re-fire per keystroke. The ref tracking `prev` also means a component mounted with the textarea *already* past the cap stays silent — the pill is already rose.
- Clicking **"Don't show again this session"** writes `chatV9.inputSoftLimitToastDismissedForSession = '1'` and the listener bails on every subsequent render in this tab. A brand-new tab gets a fresh `sessionStorage` and re-arms the nudge.
- `Dismiss` closes the toast without persisting; the per-tab fire sentinel still keeps the nudge silent for the rest of this tab.
- Never blocks Send. Never fires telemetry. The long-message distribution is already visible through the counter's tone classes in existing e2e traces.

**Resolution order** for the `ff.input_soft_limit_toast` flag: URL `?ff_inputSoftLimitToast` ▸ `localStorage["ff.input_soft_limit_toast"]` ▸ `VITE_INPUT_SOFT_LIMIT_TOAST` ▸ default ON.

**Delivered files.**

- `src/utils/inputSoftLimitToastFlag.ts` — resolver + `INPUT_SOFT_LIMIT_TOAST_FLAG_KEYS` + sessionStorage helpers (`has/markFired`, `is/markDismissed`).
- `src/components/AIChat/InputSoftLimitToast.tsx` — headless listener; builds the message via `buildInputSoftLimitToastMessage(length, max)`; exposes six test seams so unit tests can pin every branch without touching real sessionStorage.
- `src/components/AIChat/EnhancedChatInput.tsx` — renders the listener immediately after the `InputCharCounter` so both components share the same `value`.
- `src/utils/chatV9FeatureFlags.ts` — registered as `input-soft-limit-toast` (ticket `C-IN6`, block `input`, `specDocs` → this anchor).
- `src/components/AIChat/__tests__/InputSoftLimitToast.test.tsx` — 14 cases covering the message builder, silent-below-threshold, no-rising-edge-on-first-render, rising-edge fires exactly once, flag-OFF path, dismiss sentinel, fire sentinel, in-mount cross-down-cross sequence stays silent, non-string defensive guard, throwing notifier / sentinel writers all caught.
- `src/utils/__tests__/chatV9FeatureFlags.test.ts` — added to `EXPECTED_IDS`.

**DoD (all met).**

- ✅ At most one toast per tab regardless of keystroke churn.
- ✅ `Don't show again this session` persists the opt-out for the tab.
- ✅ Kill-switch OFF = zero side-effects (no toast, no sentinel writes).
- ✅ Send is never blocked.
- ✅ No telemetry added.
- ✅ No coupling to the counter's internal render — both components read `value` and `max` independently.

**Out of scope for -lite v1.**

- **Permanent opt-out via UI.** Only tab-scoped silence is persisted. A permanent opt-out belongs in the Admin flag panel if it ever becomes a real request.
- **Per-cap escalation.** The toast fires at the one rose threshold. Multiple thresholds (e.g. 90% amber toast, 110% "shorten now" toast) would double the mute-surface maintenance for diminishing return.
- **Telemetry hook.** No `input_soft_limit_toast_shown` event. The counter's tone-class signal already covers distribution; a toast event would mostly pin user *ignore* behaviour, not distribution.
- **Localisation.** English only for now — consistent with C-IN4-lite, NAV-M2-lite, T-TR2.
- **Compose-time blocking.** Out of scope for this block entirely — soft-limit is a nudge; truncation semantics live server-side in the model adapters.

## Not shipped yet

The rest of the INPUT block (focus-mode hint strip, tool-loadout
summary, private-mode auto-detach on PII signals) is design-doc
territory only and not represented in this folder until code lands.
