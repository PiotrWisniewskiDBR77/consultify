# Chat V10 — telemetry contract (2026-04-18)

This document is the source of truth for every funnel event emitted
from this branch (V9 + V10). Any event not listed here **is not part of
the funnel** and must not be treated as such by dashboards.

## Ground rules

1. **Closed-enum payloads only.** Free-form strings are banned. If you
   need a new value, extend the enum explicitly in code review.
2. **No transcript content, ever.** Voice STT / TTS text is never a
   payload field. Length buckets are allowed (see VM10).
3. **No raw error messages.** Map every failure to a `reason` enum.
4. **Advisory contract.** All emits are wrapped in try/catch. A broken
   analytics sink must never break the feature.
5. **Flag-gated.** Every V9 event lives behind a feature flag so ops
   can kill a noisy stream without a redeploy.

Registered event names live in `src/services/funnelAnalytics.ts` as a
closed string union (`FunnelEventName`). The compiler rejects any
call site that tries to emit something else.

## Index

| Event | Ticket | Flag | Purpose |
|---|---|---|---|
| `voice_barge_in_notified` | VM4 | `barge-in-toast` | User interrupted TTS mid-playback and the ack toast actually rendered. |
| `voice_mode_legend_opened` | VM3 | `voice-mode-legend` | User opened the "?" popover that explains Dictation vs Conversation. |
| `voice_mode_legend_shortcut` | VM3.1 | `voice-legend-shortcut` | User triggered the legend popover via the Alt+Shift+V keyboard shortcut. |
| `voice_start` | VM10 | `voice-funnel-telemetry` | STT recording actually began (idle → listening transition). |
| `voice_stt_success` | VM10 | `voice-funnel-telemetry` | STT returned a usable transcript. |
| `voice_stt_fail` | VM10 | `voice-funnel-telemetry` | STT failed before producing a transcript. |
| `tts_on` | VM10 | `voice-funnel-telemetry` | `speak()` flipped state to `speaking` and intent to play was sent. |
| `private_mode_details_opened` | T-PM1 | `private-mode-details` | User opened the Private mode chip's details popover. |
| `trust_badge_opened` | T-TR1 | `trust-badge` | User opened the citation summary popover under an AI reply. |
| `pii_heuristic_warning_shown` | T-PM2-lite | `pii-heuristic-toast` | Post-send heuristic nudge rendered because the outgoing text looked like it contained email / phone / IBAN. |
| `navigation_back_to_chat_clicked` | NAV-M1 | `back-to-chat-button` | User clicked the global "Back to chat" pill on a non-chat view. |
| `navigation_back_to_chat_shortcut` | NAV-M1.1 | `back-to-chat-shortcut` | User pressed the `Alt+Shift+C` shortcut and it actually triggered `returnToFullChat()`. |
| `reasoning_runtime_started` | V10-RSN-023 | `reasoning-telemetry` | Admin invoked Reasoning Runtime (request start). |
| `reasoning_runtime_succeeded` | V10-RSN-023 | `reasoning-telemetry` | Reasoning Runtime returned success. |
| `reasoning_runtime_failed` | V10-RSN-023 | `reasoning-telemetry` | Reasoning Runtime returned failure (reason bucket). |
| `research_runtime_started` | V10-RSR-024 | `research-telemetry` | Admin invoked Research Runtime (request start). |
| `research_runtime_succeeded` | V10-RSR-024 | `research-telemetry` | Research Runtime returned success. |
| `research_runtime_failed` | V10-RSR-024 | `research-telemetry` | Research Runtime returned failure (reason bucket). |
| `research_mission_planned` | V10-RSR-024 | `research-telemetry` | Admin requested a mission plan (Wave B). |
| `research_mission_watched_delta` | V10-RSR-024 | `research-telemetry` | Admin polled watch-Δ and got an events delta (Wave B). |
| `research_mission_summary_loaded` | V10-RSR-024 | `research-telemetry` | Admin loaded mission summary snapshot (Wave B). |
| `reasoning_delegated_research_plan` | V10-RSR-024 | `research-telemetry` | Admin invoked Reasoning→Research delegation for mission planning (Wave B). |
| `connectors_runtime_started` | V10-CON-023 | `connectors-telemetry-full` | Admin invoked Connectors Runtime (request start). |
| `connectors_runtime_succeeded` | V10-CON-023 | `connectors-telemetry-full` | Connectors Runtime returned success. |
| `connectors_runtime_failed` | V10-CON-023 | `connectors-telemetry-full` | Connectors Runtime returned failure (reason bucket). |
| `connectors_registry_loaded` | V10-CON-023 | `connectors-telemetry-full` | Admin loaded typed connector registry catalog. |
| `connector_session_connected` | V10-CON-023 | `connectors-telemetry-full` | Admin connected a connector session without auth challenge. |
| `connector_auth_started` | V10-CON-023 | `connectors-telemetry-full` | Admin started connector auth challenge flow. |
| `connector_auth_completed` | V10-CON-023 | `connectors-telemetry-full` | Admin completed connector auth challenge flow. |
| `connector_source_searched` | V10-CON-023 | `connectors-telemetry-full` | Admin ran federated connector source search. |
| `connector_source_read` | V10-CON-023 | `connectors-telemetry-full` | Admin opened a normalized connector source. |
| `connector_token_refreshed` | V10-CON-023 | `connectors-telemetry-full` | Admin rotated connector token material in vault. |
| `connector_session_disconnected` | V10-CON-023 | `connectors-telemetry-full` | Admin disconnected a connector session and forgot token state. |
| `learning_runtime_started` | V10-LRN-012 | `learning-telemetry` | Admin invoked Learning Runtime (request start). |
| `learning_runtime_succeeded` | V10-LRN-012 | `learning-telemetry` | Learning Runtime returned success. |
| `learning_runtime_failed` | V10-LRN-012 | `learning-telemetry` | Learning Runtime returned failure (reason bucket). |
| `learning_loop_feedback_submitted` | V10-LRN-012 | `learning-telemetry` | Admin submitted a learning feedback signal. |
| `learning_loop_retention_previewed` | V10-LRN-012 | `learning-telemetry` | Admin ran retention preview and got retain/deny decision. |
| `learning_loop_stewardship_loaded` | V10-LRN-012 | `learning-telemetry` | Admin loaded stewardship queue snapshot. |
| `learning_loop_stewardship_resolved` | V10-LRN-012 | `learning-telemetry` | Admin resolved a stewardship queue item. |
| `learning_loop_incident_reported` | V10-LRN-012 | `learning-telemetry` | Admin reported drift/incident for learning loop. |
| `learning_loop_dashboard_loaded` | V10-LRN-012 | `learning-telemetry` | Admin loaded quality dashboard snapshot. |
| `outcome_runtime_started` | V10-OUT-018 | `outcome-telemetry` | Admin invoked Outcome Runtime (request start). |
| `outcome_runtime_succeeded` | V10-OUT-018 | `outcome-telemetry` | Outcome Runtime returned success. |
| `outcome_runtime_failed` | V10-OUT-018 | `outcome-telemetry` | Outcome Runtime returned failure (reason bucket). |
| `outcome_kpi_acceptance_previewed` | V10-OUT-018 | `outcome-telemetry` | Admin generated KPI acceptance preview for business outcome review. |
| `outcome_signal_ingested` | V10-OUT-018 | `outcome-telemetry` | Admin captured an outcome signal candidate. |
| `outcome_acceptance_resolved` | V10-OUT-018 | `outcome-telemetry` | Admin resolved an outcome acceptance contract. |
| `outcome_business_linked` | V10-OUT-018 | `outcome-telemetry` | Admin linked analysis to a business effect summary. |
| `onboard_runtime_started` | V10-ONB-023 | `onboard-telemetry` | Admin invoked Onboarding Runtime (request start). |
| `onboard_runtime_succeeded` | V10-ONB-023 | `onboard-telemetry` | Onboarding Runtime returned success. |
| `onboard_runtime_failed` | V10-ONB-023 | `onboard-telemetry` | Onboarding Runtime returned failure (reason bucket). |
| `onboard.artifact_blocked` | V10-ONB-021 | `onboard-citation-validation-fallback` | Onboarding blocked fallback rendered because evidence policy was not met. |

---

## `voice_barge_in_notified`

**Ticket:** VM4 · **Flag:** `ff.barge_in_toast` · **Source:**
`src/utils/bargeInToast.ts`

Emitted **only** when the 1.5 s debounce guard has passed and the user
actually saw the acknowledgement toast. Drops inside the window do not
emit — we count visible toasts, not button presses.

### Payload

| Field | Type | Cardinality |
|---|---|---|
| `source` | `'mute_button' \| 'replay_button' \| 'mic_button' \| 'end_conversation' \| 'unknown'` | closed enum |

### Regression signals

- Emission rate > 1 per session: debounce is broken.
- `source === 'unknown'` trending up: a new call site was added without
  labelling. Trace back via git blame on `notifyBargeIn()`.

---

## `voice_mode_legend_opened`

**Ticket:** VM3 · **Flag:** `ff.voice_mode_legend` · **Source:**
`src/components/AIChat/VoiceModeLegend.tsx`

One event per distinct open gesture. Closing the popover is silent.
Re-opening after a close emits a new event — each open is a fresh
"I needed an explanation now" signal.

### Payload

Empty object (`{}`). Intentional: we don't want surface-level splits
yet because there is only one legend trigger in the UI.

### Regression signals

- Emission rate trending upward **and** `voice_start` flat → legend is
  becoming a replacement for the mic. Worth a copy / discoverability
  review of the mic button itself.

---

## `voice_mode_legend_shortcut`

**Ticket:** VM3.1 · **Flag:** `ff.voice_legend_shortcut` · **Source:**
`src/components/AIChat/VoiceLegendShortcut.tsx`

One event per Alt+Shift+V keypress that survives the editable-target
and open-modal guards. Fires **before** the `chat-v9-voice-legend:open`
CustomEvent dispatch, and so always lands even if the legend
component is not mounted on the current route. The downstream
`voice_mode_legend_opened` event (emitted by the legend's own
`handleOpen`) still fires in the happy-path case, so the two events
together answer "chord used" AND "chord actually opened a legend".

### Payload

Empty object (`{}`). Symmetric with `voice_mode_legend_opened`. The
split into two events is intentional: a single `trigger: 'click' |
'shortcut'` field on the original event would have tied VM3's
telemetry contract to VM3.1's rollout, and any rename / removal
would force a downstream dashboard migration.

### Regression signals

- `voice_mode_legend_shortcut` emissions without a matching
  `voice_mode_legend_opened` within the same session suggest the
  user hit the chord on a route that has no `VoiceModeLegend` mounted
  (expected on `/settings`, `/admin`, etc.). Trending up steeply
  without any chat usage → the chord is being mis-discovered and we
  should consider hiding the shortcut when outside `/chat`.
- `voice_mode_legend_shortcut` flat **and** `voice_mode_legend_opened`
  climbing → users still rely on the mouse; the chord is invisible.
  Candidate for an in-popover hint.

---

## Voice funnel (VM10)

**Ticket:** VM10 · **Flag:** `ff.voice_funnel_telemetry` · **Source:**
`src/utils/voiceFunnelTelemetry.ts` (emit helpers) and
`src/hooks/useUniversalVoice.ts` (call sites).

Four events capture the STT/TTS funnel. All share a common PII
contract: no transcript content, no audio, no raw error strings.

### Shared enums

| Enum | Values |
|---|---|
| `sttProvider` | `'whisper' \| 'web'` |
| `ttsProvider` | `'openai' \| 'edge' \| 'web'` |
| `trigger` | `'single' \| 'conversation'` |
| `VoiceSttFailReason` | `'permission_denied' \| 'no_speech' \| 'server_error' \| 'network' \| 'aborted' \| 'unknown'` |
| `transcriptLengthBucket` | `'empty' \| 'short' (≤40) \| 'medium' (≤200) \| 'long' (>200)` |

### `voice_start`

Fires when `startListening()` transitions idle → listening. Duplicate
calls while already listening do **not** emit. Emission precedes any
actual audio capture, so a subsequent `voice_stt_fail:permission_denied`
is expected when mic consent is rejected.

| Field | Type |
|---|---|
| `sttProvider` | `sttProvider` |
| `trigger` | `trigger` |
| `language` | `'pl' \| 'en' \| 'de' \| 'ar' \| 'jp' \| 'es'` |

### `voice_stt_success`

Fires when Whisper returns text OR Web Speech produces a final result.
Interim Web Speech results do not emit.

| Field | Type |
|---|---|
| `sttProvider` | `sttProvider` |
| `trigger` | `trigger` |
| `language` | language code |
| `transcriptLengthBucket` | `transcriptLengthBucket` |

### `voice_stt_fail`

Fires on every failure path that ends the STT attempt without a
transcript (including mic permission, network, web-speech errors, and
`no-speech` non-errors).

| Field | Type |
|---|---|
| `sttProvider` | `sttProvider` |
| `trigger` | `trigger` |
| `language` | language code |
| `reason` | `VoiceSttFailReason` |

### `tts_on`

Fires when `speak()` flips state to `speaking`. Emitted **before** the
provider fetch so user intent is captured even when the backend later
rejects the request.

| Field | Type |
|---|---|
| `ttsProvider` | `ttsProvider` |
| `language` | language code |
| `auto` | `boolean` — reflects `settings.autoSpeakResponses`, not per-call intent |

### Derived funnel (reference shape)

```
voice_start             ── 100% baseline
 ├─ voice_stt_success   ── success ratio (by sttProvider × trigger × language)
 └─ voice_stt_fail      ── failure ratio
         └─ breakdown by `reason`
tts_on                  ── independent stream; pair with `voice_stt_success`
                           per session to see "listened → heard back" rate
voice_barge_in_notified ── mid-TTS interruption rate vs `tts_on`
```

### Regression signals

- `voice_stt_fail:unknown` > 5 % of failures → add a mapping for the
  error shape you observe; `'unknown'` is only meant as a catch-all.
- `voice_stt_fail:permission_denied` spike **after** `voice_start` went
  up → onboarding copy around mic access regressed.
- `transcriptLengthBucket === 'empty'` > 10 % of `voice_stt_success`
  → VAD / Whisper silence detection is returning empty strings as
  "success". Re-classify those as `voice_stt_fail:no_speech`.
- `tts_on` far exceeds `voice_stt_success` in conversation mode → the
  auto-read chain is firing twice per turn somewhere.

---

## `private_mode_details_opened`

**Ticket:** T-PM1 · **Flag:** `ff.private_mode_details` · **Source:**
`src/components/AIChat/PrivateModeDetails.tsx`

Emitted when the user clicks the "Private mode" chip and the details
popover opens. The popover only exists when `aiConfig.privateMode ===
true`, so every emission implies private mode is already active.

### Payload

Empty object (`{}`). The badge is only visible when private mode is
already on, so the event's **presence** is the full signal. We do not
split by tenant or user id — that would re-introduce PII into what is
meant to be a trust-signal event.

### Regression signals

- Event rate trending up **without** a matching uptick in
  `ai_private_mode_enabled` → users are already in private mode (perhaps
  via tenant default) and are now actively seeking an explanation.
  That's a signal the one-line chip tooltip is insufficient — validate
  the popover copy in a user test.
- Flat after a copy change → verify the popover still mounts after the
  swap; a regression that breaks the click handler would zero this out
  silently.

---

## `trust_badge_opened`

**Ticket:** T-TR1 · **Flag:** `ff.trust_badge` · **Source:**
`src/components/AIChat/TrustBadge.tsx`

Emitted when the user clicks the trust badge beneath an AI reply and
the citation summary popover opens. Purely a user-intent signal; the
badge itself renders unconditionally on every AI reply, so we do not
emit for mere visibility.

### Payload

| Field | Type | Cardinality |
|---|---|---|
| `sourceCount` | `'none' \| 'few' \| 'many'` | closed enum. `none` = 0 citations; `few` = 1–3; `many` = 4+. Raw counts are **never** emitted. |
| `hasModel` | `boolean` | Whether `msg.metadata.modelUsed` was a clean non-empty string at click time. Model **name** is never emitted. |

### PII contract

- No message id, conversation id, tenant id, or user id.
- No citation titles, references, links, or excerpts.
- No model name — `hasModel` is boolean only.
- `sourceCount` is bucketed to prevent per-message fingerprinting.
- Regression test in `TrustBadge.test.tsx` freezes the exact payload
  shape and explicitly asserts that raw counts, titles, and model
  names are absent.

### Regression signals

- `sourceCount === 'none'` dominates → retrieval pipeline is under-
  citing replies, or citation extraction is dropping valid sources.
- `hasModel === false` trending up → the persistence layer stopped
  writing `metadata.modelUsed` on save. Check the AI write path; the
  badge itself has no backend dependency.
- Event rate flat after a render refactor → click handler regressed
  or the component was accidentally hidden behind another element.

---

## `pii_heuristic_warning_shown`

**Ticket:** T-PM2-lite · **Flag:** `ff.pii_heuristic_toast` ·
**Source:** `src/components/AIChat/PiiHeuristicToast.tsx`

Emitted when the headless post-send listener actually rendered a
toast because `detectPiiCategories()` returned at least one hit on
the user's outgoing message. The event is cooldown-throttled (4 s)
on the client, so it is a "user was nudged" signal rather than "PII
existed in a sent message" — the latter would require counting
suppressed events, which we deliberately do not do.

### Payload

| Field | Type | Cardinality |
|---|---|---|
| `categories` | `Array<'email' \| 'phone' \| 'iban'>` | Closed enum. Priority-ordered (`email → phone → iban`), never duplicated, always at least one entry. |

### PII contract

- No raw message, no substring of the message, no match offsets, no
  character counts.
- No conversation id, message id, user id, tenant id.
- The category list is a closed enum — new classes (PESEL, NIP,
  credit card, …) require a code + contract change, never a
  silently-added string.
- Regression test in `PiiHeuristicToast.test.tsx` freezes the
  payload shape and explicitly asserts the raw text does not leak
  into the serialised payload.

### Regression signals

- Event rate drops to zero after a client release → either
  `EnhancedChatInput.handleSend` stopped dispatching
  `chat-v9-pii-check`, the listener was unmounted by an App
  refactor, or the kill-switch flipped OFF in a shared env.
- `categories` dominated by `iban` with no `email` / `phone` →
  the candidate regex for IBAN may be too loose (check for
  false positives on product SKUs starting with two letters).
- Burst of events from a single session right after a context
  paste → paste-in behaviour is flooding the send path; consider
  a distinct "paste" telemetry event or widening the cooldown.

---

## `navigation_back_to_chat_clicked`

**Ticket:** NAV-M1 · **Flag:** `ff.back_to_chat_button` · **Source:**
`src/components/navigation/BackToChatButton.tsx`

Emitted when the user clicks the globally-mounted "Back to chat"
floating pill. The button itself only renders on non-chat views
with an active conversation, so every emission maps to a concrete
cross-module return intent.

### Payload

| Field | Type | Cardinality |
|---|---|---|
| `fromView` | `AppView` | closed enum (string values mirroring the `AppView` TypeScript enum, e.g. `'MY_WORK'`, `'WORDY'`, `'FULL_STEP2_INITIATIVES'`). Never a free-form string. |

### PII contract

- No conversation id, message id, tenant id, or user id.
- No artifact id, title, or route parameters.
- `fromView` is drawn from the closed `AppView` enum; adding a
  view requires a compile-time change to `types/core.ts` and is
  caught in code review.

### Regression signals

- Rate dominated by a single `fromView` → that module is the worst
  offender for path-loss; consider an in-header "return to
  conversation" affordance so the global pill is a fallback, not
  the primary route.
- Flat after a layout refactor → the pill was covered by a
  higher-z-index overlay or the click handler regressed. The
  corresponding `BackToChatButton.test.tsx` guards click → telemetry
  → navigation wiring.
- Rate drops to zero while `AI_CHAT` inbound traffic holds steady →
  users are returning to chat through the sidebar / browser back
  instead; the pill may be redundant on those specific views.

---

## `navigation_back_to_chat_shortcut`

**Ticket:** NAV-M1.1 · **Flag:** `ff.back_to_chat_shortcut` · **Source:**
`src/components/navigation/BackToChatShortcut.tsx`

Emitted only when the user presses `Alt+Shift+C`
(macOS `Option+Shift+C`) **and** the handler actually called
`returnToFullChat()`. The handler short-circuits on `AI_CHAT` /
`WELCOME`, on missing `activeConversationId`, on focus inside an
editable element, and on any open `aria-modal="true"` element; none
of those paths emit telemetry. A signal here therefore always
represents a completed keyboard-driven return.

### Payload

| Field | Type | Cardinality |
|---|---|---|
| `fromView` | `AppView` | closed enum, same as `navigation_back_to_chat_clicked`. |

### PII contract

- Symmetric with `navigation_back_to_chat_clicked`: no conversation
  id, message id, tenant id, user id, artifact id, title, or route
  parameters.
- We deliberately **do not** log the key combo or a
  `trigger: 'shortcut'` field. The event name itself is the
  discriminator; separating `_clicked` and `_shortcut` into two
  events keeps each payload minimal and lets the two flags be
  tuned independently in the funnel.

### Regression signals

- `_shortcut` rate ≫ `_clicked` rate on the same `fromView` →
  keyboard power-users have adopted the shortcut and the pill can
  possibly be demoted on that view. Do not remove it yet — the
  pill is the discoverability path that teaches the shortcut.
- `_shortcut` drops to zero while `_clicked` holds → a third-party
  extension or a new dialog is intercepting the combo before our
  listener; check the flag registry and the open-modal guard.
- Spike of `_shortcut` on `AI_CHAT` → the view gate regressed.
  The unit test `BackToChatShortcut.test.tsx` asserts AI_CHAT and
  WELCOME both short-circuit.

---

## Chat V10 runtime MVP telemetry (Phase 4)

These events instrument the minimal V10 runtime endpoints exposed in the
admin panel. They are **PII-safe** by construction:

- No prompts, queries, URLs, personas, or response bodies.
- No ids (no missionId / requestId / onboardingId / outcomeId).
- Failures are bucketed to a `reason` enum (no raw error messages).

### Shared enums

| Enum | Values |
|---|---|
| `source` | `'admin_panel' \| 'chat' \| 'unknown'` |
| `httpStatusBucket` | `'2xx' \| '4xx' \| '5xx' \| '0' \| 'unknown'` |
| `latencyBucketMs` | `'lt_250' \| 'lt_1000' \| 'lt_5000' \| 'gte_5000' \| 'unknown'` |
| `V10RuntimeFailReason` | `'flag_off' \| 'unauthorized' \| 'validation' \| 'server_error' \| 'network' \| 'unknown'` |

---

## `reasoning_runtime_started`

**Ticket:** V10-RSN-023 · **Flag:** `ff.reasoning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |

---

## `reasoning_runtime_succeeded`

**Ticket:** V10-RSN-023 · **Flag:** `ff.reasoning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |

---

## `reasoning_runtime_failed`

**Ticket:** V10-RSN-023 · **Flag:** `ff.reasoning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |
| `reason` | `V10RuntimeFailReason` |

---

## `research_runtime_started`

**Ticket:** V10-RSR-024 · **Flag:** `ff.research_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |

---

## `research_runtime_succeeded`

**Ticket:** V10-RSR-024 · **Flag:** `ff.research_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |

---

## `research_runtime_failed`

**Ticket:** V10-RSR-024 · **Flag:** `ff.research_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |
| `reason` | `V10RuntimeFailReason` |

---

## `research_mission_planned`

**Ticket:** V10-RSR-024 · **Flag:** `ff.research_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `'admin_panel' \| 'unknown'` |
| `depth` | `'quick' \| 'standard' \| 'deep'` |
| `maxSourcesBucket` | `'1_5' \| '6_10' \| '11_20' \| '21_plus'` |

---

## `research_mission_watched_delta`

**Ticket:** V10-RSR-024 · **Flag:** `ff.research_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `'admin_panel' \| 'unknown'` |
| `eventsCountBucket` | `'0' \| '1_3' \| '4_10' \| '11_plus'` |
| `completed` | `boolean` |

---

## `research_mission_summary_loaded`

**Ticket:** V10-RSR-024 · **Flag:** `ff.research_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `'admin_panel' \| 'unknown'` |
| `status` | `'planned' \| 'running' \| 'completed' \| 'unknown'` |

---

## `reasoning_delegated_research_plan`

**Ticket:** V10-RSR-024 · **Flag:** `ff.research_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `'admin_panel' \| 'unknown'` |
| `depth` | `'quick' \| 'standard' \| 'deep'` |

---

## `connectors_runtime_started`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |

---

## `connectors_runtime_succeeded`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |

---

## `connectors_runtime_failed`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |
| `reason` | `V10RuntimeFailReason` |

---

## `connectors_registry_loaded`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `total` | `number` |
| `available` | `number` |
| `planned` | `number` |

---

## `connector_session_connected`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `connectorId` | `string` |
| `status` | `'connected' \| 'pending' \| 'needs_reauth' \| 'disconnected' \| 'completed' \| 'stored'` |

---

## `connector_auth_started`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `connectorId` | `string` |

---

## `connector_auth_completed`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `connectorId` | `string` |
| `status` | `'connected' \| 'pending' \| 'needs_reauth' \| 'disconnected' \| 'completed' \| 'stored'` |

---

## `connector_source_searched`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `connectorCount` | `number` |
| `sourceCount` | `number` |

---

## `connector_source_read`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `connectorId` | `string` |

---

## `connector_token_refreshed`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `connectorId` | `string` |
| `status` | `'connected' \| 'pending' \| 'needs_reauth' \| 'disconnected' \| 'completed' \| 'stored'` |

---

## `connector_session_disconnected`

**Ticket:** V10-CON-023 · **Flag:** `ff.connectors_telemetry_full` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `connectorId` | `string` |

---

## `learning_runtime_started`

**Ticket:** V10-LRN-012 · **Flag:** `ff.learning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |

---

## `learning_runtime_succeeded`

**Ticket:** V10-LRN-012 · **Flag:** `ff.learning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |

---

## `learning_runtime_failed`

**Ticket:** V10-LRN-012 · **Flag:** `ff.learning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |
| `reason` | `V10RuntimeFailReason` |

---

## `learning_loop_feedback_submitted`

**Ticket:** V10-LRN-012 · **Flag:** `ff.learning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/learningLoopTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `rating` | `1 \| 2 \| 3 \| 4 \| 5` |
| `targetType` | `'chat' \| 'artifact' \| 'tool' \| 'unknown'` |
| `queuedForStewardship` | `boolean` |

---

## `learning_loop_retention_previewed`

**Ticket:** V10-LRN-012 · **Flag:** `ff.learning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/learningLoopTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `decision` | `'retain' \| 'deny'` |

---

## `learning_loop_stewardship_loaded`

**Ticket:** V10-LRN-012 · **Flag:** `ff.learning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/learningLoopTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `itemsCountBucket` | `'0' \| '1_5' \| '6_20' \| '21_plus'` |

---

## `learning_loop_stewardship_resolved`

**Ticket:** V10-LRN-012 · **Flag:** `ff.learning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/learningLoopTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |

---

## `learning_loop_incident_reported`

**Ticket:** V10-LRN-012 · **Flag:** `ff.learning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/learningLoopTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `kind` | `'drift' \| 'incident'` |
| `severity` | `'low' \| 'medium' \| 'high'` |

---

## `learning_loop_dashboard_loaded`

**Ticket:** V10-LRN-012 · **Flag:** `ff.learning_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/learningLoopTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |

---

## `outcome_runtime_started`

**Ticket:** V10-OUT-018 · **Flag:** `ff.outcome_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |

---

## `outcome_runtime_succeeded`

**Ticket:** V10-OUT-018 · **Flag:** `ff.outcome_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |

---

## `outcome_runtime_failed`

**Ticket:** V10-OUT-018 · **Flag:** `ff.outcome_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |
| `reason` | `V10RuntimeFailReason` |

---

## `outcome_kpi_acceptance_previewed`

**Ticket:** V10-OUT-018 · **Flag:** `ff.outcome_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/outcomeFlowTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `'admin_panel' \| 'unknown'` |
| `metricsCountBucket` | `'1' \| '2_3' \| '4_5' \| '6_plus'` |

---

## `outcome_signal_ingested`

**Ticket:** V10-OUT-018 · **Flag:** `ff.outcome_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/outcomeFlowTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `'admin_panel' \| 'unknown'` |
| `kind` | `'time_saved' \| 'decision_shipped' \| 'revenue' \| 'margin' \| 'risk_avoided' \| 'quality'` |

---

## `outcome_acceptance_resolved`

**Ticket:** V10-OUT-018 · **Flag:** `ff.outcome_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/outcomeFlowTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `'admin_panel' \| 'unknown'` |
| `decision` | `'accepted' \| 'rejected' \| 'needs_revision'` |
| `acceptedCountBucket` | `'0' \| '1' \| '2_3' \| '4_plus'` |

---

## `outcome_business_linked`

**Ticket:** V10-OUT-018 · **Flag:** `ff.outcome_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/utils/v10/outcomeFlowTelemetry.ts`

### Payload

| Field | Type |
|---|---|
| `source` | `'admin_panel' \| 'unknown'` |
| `metricsCountBucket` | `'1' \| '2_3' \| '4_5' \| '6_plus'` |
| `strongestSignalKind` | `'time_saved' \| 'decision_shipped' \| 'revenue' \| 'margin' \| 'risk_avoided' \| 'quality'` |

---

## `onboard_runtime_started`

**Ticket:** V10-ONB-023 · **Flag:** `ff.onboard_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |

---

## `onboard_runtime_succeeded`

**Ticket:** V10-ONB-023 · **Flag:** `ff.onboard_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |

---

## `onboard_runtime_failed`

**Ticket:** V10-ONB-023 · **Flag:** `ff.onboard_telemetry` · **Source:**
`src/components/Admin/ChatV10RuntimesPanel.tsx`

### Payload

| Field | Type |
|---|---|
| `source` | `source` |
| `latencyBucketMs` | `latencyBucketMs` |
| `httpStatusBucket` | `httpStatusBucket` |
| `reason` | `V10RuntimeFailReason` |

---

## `onboard.artifact_blocked`

**Ticket:** V10-ONB-021 · **Flag:** `ff.onboard_citation_validation_fallback` · **Source:**
`src/utils/v10/onboardCitationValidationFallbackFlag.ts`

Emitted when onboarding must block finalisation because evidence policy
is not met and the UI renders an honest scaffold instead of a conclusion.

### Payload

| Field | Type | Cardinality |
|---|---|---|
| `reason` | `'low_coverage' \| 'missing_required_source_type'` | closed enum |
| `coverageBucket` | `'lt_0_5' \| 'lt_0_8' \| 'gte_0_8' \| 'unknown'` | closed enum |
