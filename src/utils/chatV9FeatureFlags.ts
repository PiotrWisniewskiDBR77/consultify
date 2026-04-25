/**
 * Chat V9 / ADMIN AG3 — central registry of feature flags currently shipped
 * as part of the Chat V9 rollout.
 *
 * Scope (pass 33, 2026-04-18)
 * ---------------------------
 * Earlier V9 waves planned ~13 flags. Only the ones whose helper modules are
 * present in this branch are registered here — see the registry scope note
 * below. The design pattern itself is unchanged; each flag must own its
 * `src/utils/<name>Flag.ts` helper and follow the shared resolution contract:
 *
 *   1. URL query override (`?ff_<key>=0|1`) — wins and may persist into
 *      localStorage so the user can rollback from any tab.
 *   2. `localStorage["ff.<key>"]` — organisation-level rollback without redeploy.
 *   3. `import.meta.env.VITE_<KEY>` — build-time default per deploy.
 *   4. Hardcoded default (ON for currently-registered flags).
 *
 * The per-flag files stay the source of truth for the runtime decision. This
 * file is a *mirror index* that answers three questions the admin / owner
 * actually asks:
 *
 *   - "Which V9 flags exist right now?" → `CHAT_V9_FLAGS`
 *   - "What's flipped in **this** browser session?" → `getChatV9FlagSnapshot()`
 *   - "Where do I find the spec / test-id / telemetry for X?" → descriptor
 *     fields (`specDocs`, `testId`, `telemetry`).
 *
 * It is intentionally **pure data + thin accessors**. No side effects, no
 * writes — that lives in the per-flag helpers so SSR-safety, private-mode
 * handling and localStorage quota fallbacks stay in one place each.
 */

// ---------------------------------------------------------------------------
// Registry scope note (pass 33 · 2026-04-18)
// ---------------------------------------------------------------------------
// Earlier Chat V9 milestones (M0/M1/Wave 2) planned ~13 per-feature flag
// helpers (`moduleBackToChatFlag`, `scopeSummaryFlag`, …). The implementation
// landed as design docs + this registry scaffolding, but the per-flag helper
// modules are not in the `develop` branch of this submodule. Rather than
// ship a file with 12 broken imports, the registry now enumerates ONLY the
// flags whose helper modules actually exist on disk. When a V9 feature is
// restored / implemented:
//
//   1. Drop its `<name>Flag.ts` under `src/utils/`.
//   2. Import `{ <KEY>_FLAG_KEYS, is<Name>Enabled }` here.
//   3. Append a descriptor block to `CHAT_V9_FLAGS` and the matching id to
//      `EXPECTED_IDS` in `chatV9FeatureFlags.test.ts`.
//
// This keeps the registry honest: every entry compiles, every resolver
// resolves. No more zombie scaffolding for features that never shipped.
// ---------------------------------------------------------------------------

import { BACK_TO_CHAT_BUTTON_FLAG_KEYS, isBackToChatButtonEnabled } from './backToChatButtonFlag';
import {
  BACK_TO_CHAT_SHORTCUT_FLAG_KEYS,
  isBackToChatShortcutEnabled,
} from './backToChatShortcutFlag';
import { BARGE_IN_TOAST_FLAG_KEYS, isBargeInToastEnabled } from './bargeInToastFlag';
import {
  FLAGS_PANEL_DESCRIPTION_EXPAND_FLAG_KEYS,
  isFlagsPanelDescriptionExpandEnabled,
} from './flagsPanelDescriptionExpandFlag';
import {
  FLAGS_PANEL_DOC_LINKS_FLAG_KEYS,
  isFlagsPanelDocLinksEnabled,
} from './flagsPanelDocLinksFlag';
import {
  FLAGS_PANEL_FILTER_ESCAPE_CLEAR_FLAG_KEYS,
  isFlagsPanelFilterEscapeClearEnabled,
} from './flagsPanelFilterEscapeClearFlag';
import { FLAGS_PANEL_FILTER_FLAG_KEYS, isFlagsPanelFilterEnabled } from './flagsPanelFilterFlag';
import {
  FLAGS_PANEL_GROUPING_FLAG_KEYS,
  isFlagsPanelGroupingEnabled,
} from './flagsPanelGroupingFlag';
import {
  FLAGS_PANEL_OVERRIDE_URL_COPY_FLAG_KEYS,
  isFlagsPanelOverrideUrlCopyEnabled,
} from './flagsPanelOverrideUrlCopyFlag';
import {
  FLAGS_PANEL_ROW_SHORTCUTS_FLAG_KEYS,
  isFlagsPanelRowShortcutsEnabled,
} from './flagsPanelRowShortcutsFlag';
import {
  FLAGS_PANEL_SHORTCUT_CHEAT_SHEET_FLAG_KEYS,
  isFlagsPanelShortcutCheatSheetEnabled,
} from './flagsPanelShortcutCheatSheetFlag';
import {
  FLAGS_PANEL_STICKY_GROUP_HEADERS_FLAG_KEYS,
  isFlagsPanelStickyGroupHeadersEnabled,
} from './flagsPanelStickyGroupHeadersFlag';
import { FLAGS_RESET_URL_FLAG_KEYS, isFlagsResetUrlEnabled } from './flagsResetUrlFlag';
import { FLAGS_SNAPSHOT_COPY_FLAG_KEYS, isFlagsSnapshotCopyEnabled } from './flagsSnapshotCopyFlag';
import { INPUT_CHAR_COUNTER_FLAG_KEYS, isInputCharCounterEnabled } from './inputCharCounterFlag';
import { INPUT_HINT_STRIP_FLAG_KEYS, isInputHintStripEnabled } from './inputHintStripFlag';
import {
  INPUT_SOFT_LIMIT_TOAST_FLAG_KEYS,
  isInputSoftLimitToastEnabled,
} from './inputSoftLimitToastFlag';
import { isNextModelChipEnabled, NEXT_MODEL_CHIP_FLAG_KEYS } from './nextModelChipFlag';
import {
  isPiiHeuristicSessionDismissEnabled,
  PII_HEURISTIC_SESSION_DISMISS_FLAG_KEYS,
} from './piiHeuristicSessionDismissFlag';
import { isPiiHeuristicToastEnabled, PII_HEURISTIC_TOAST_FLAG_KEYS } from './piiHeuristicToastFlag';
import {
  isPrivateModeDetailsEnabled,
  PRIVATE_MODE_DETAILS_FLAG_KEYS,
} from './privateModeDetailsFlag';
import {
  isTrustBadgeCitationDomainEnabled,
  TRUST_BADGE_CITATION_DOMAIN_FLAG_KEYS,
} from './trustBadgeCitationDomainFlag';
import {
  isTrustBadgeCitationLinksEnabled,
  TRUST_BADGE_CITATION_LINKS_FLAG_KEYS,
} from './trustBadgeCitationLinksFlag';
import {
  isTrustBadgeCopyCitationsEnabled,
  TRUST_BADGE_COPY_CITATIONS_FLAG_KEYS,
} from './trustBadgeCopyCitationsFlag';
import {
  isTrustBadgeCopyReasoningEnabled,
  TRUST_BADGE_COPY_REASONING_FLAG_KEYS,
} from './trustBadgeCopyReasoningFlag';
import { isTrustBadgeEnabled, TRUST_BADGE_FLAG_KEYS } from './trustBadgeFlag';
import {
  isTrustBadgeHumanizeModelEnabled,
  TRUST_BADGE_HUMANIZE_MODEL_FLAG_KEYS,
} from './trustBadgeHumanizeModelFlag';
import {
  isTrustBadgeReasoningEnabled,
  TRUST_BADGE_REASONING_FLAG_KEYS,
} from './trustBadgeReasoningFlag';
import {
  isVoiceFunnelTelemetryEnabled,
  VOICE_FUNNEL_TELEMETRY_FLAG_KEYS,
} from './voiceFunnelTelemetryFlag';
import {
  isVoiceLegendCopyTextEnabled,
  VOICE_LEGEND_COPY_TEXT_FLAG_KEYS,
} from './voiceLegendCopyTextFlag';
import {
  isVoiceLegendShortcutEnabled,
  VOICE_LEGEND_SHORTCUT_FLAG_KEYS,
} from './voiceLegendShortcutFlag';
import { isVoiceModeLegendEnabled, VOICE_MODE_LEGEND_FLAG_KEYS } from './voiceModeLegendFlag';
import {
  isWorkspaceBreadcrumbConversationEnabled,
  WORKSPACE_BREADCRUMB_CONVERSATION_FLAG_KEYS,
} from './workspaceBreadcrumbConversationFlag';
import {
  isWorkspaceBreadcrumbEnabled,
  WORKSPACE_BREADCRUMB_FLAG_KEYS,
} from './workspaceBreadcrumbFlag';
import {
  isWorkspaceBreadcrumbRecentsArrowKeysEnabled,
  WORKSPACE_BREADCRUMB_RECENTS_ARROW_KEYS_FLAG_KEYS,
} from './workspaceBreadcrumbRecentsArrowKeysFlag';
import {
  isWorkspaceBreadcrumbRecentsEnabled,
  WORKSPACE_BREADCRUMB_RECENTS_FLAG_KEYS,
} from './workspaceBreadcrumbRecentsFlag';
import {
  isWorkspaceBreadcrumbRecentsPinnedEnabled,
  WORKSPACE_BREADCRUMB_RECENTS_PINNED_FLAG_KEYS,
} from './workspaceBreadcrumbRecentsPinnedFlag';
import {
  isWorkspaceBreadcrumbRecentsTriggerArrowEnabled,
  WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_FLAG_KEYS,
} from './workspaceBreadcrumbRecentsTriggerArrowFlag';
import {
  isWorkspaceBreadcrumbRecentsTriggerArrowUpEnabled,
  WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_UP_FLAG_KEYS,
} from './workspaceBreadcrumbRecentsTriggerArrowUpFlag';
import {
  isWorkspaceBreadcrumbRecentsViewAllEnabled,
  WORKSPACE_BREADCRUMB_RECENTS_VIEW_ALL_FLAG_KEYS,
} from './workspaceBreadcrumbRecentsViewAllFlag';

export type ChatV9Block = 'navigation' | 'trust' | 'voice' | 'input' | 'admin';

export interface ChatV9FlagKeys {
  readonly localStorage: string;
  readonly query: string;
  readonly env: string;
}

export interface ChatV9FlagDescriptor {
  /** Stable, kebab-case identifier used by this registry and the runbook. */
  readonly id: string;
  /** Ticket code from the Chat V9 development plans (e.g. `NA1`, `TS5`). */
  readonly ticket: string;
  /** Block as used in the audits / readiness scoreboard. */
  readonly block: ChatV9Block;
  /** Short human title. */
  readonly title: string;
  /** One-liner describing user-visible behaviour when enabled. */
  readonly description: string;
  /** Hardcoded default used when no override is present. */
  readonly default: boolean;
  /** URL / localStorage / ENV keys that drive the resolver. */
  readonly keys: ChatV9FlagKeys;
  /** Bound resolver. SSR-safe — returns the `default` when `window` is absent. */
  readonly isEnabled: () => boolean;
  /** Telemetry events emitted by the feature. Empty array = not yet instrumented. */
  readonly telemetry: readonly string[];
  /** Primary `data-testid` used by QA / the owner runbook to verify visibility. */
  readonly testId: string | null;
  /** Spec docs the owner should read before rolling forward / back. */
  readonly specDocs: readonly string[];
}

/**
 * **Order matters** — it mirrors the milestone timeline in
 * `CHAT_V9_IMPLEMENTATION_ROADMAP_2026-04-18.md §0` (M0 navigation/trust/voice
 * quick wins first). The owner's dashboard / runbook walks this list top-down.
 */
export const CHAT_V9_FLAGS: readonly ChatV9FlagDescriptor[] = [
  {
    id: 'barge-in-toast',
    ticket: 'VM4',
    block: 'voice',
    title: 'Barge-in acknowledgement toast',
    description:
      'Short confirmation toast ("Reading interrupted.") that fires when the user mutes TTS mid-playback via the volume button in `UnifiedChatPanel`. Debounced at 1.5 s so rapid multi-mute gestures never produce more than one visible toast. Kill-switch: gate makes `notifyBargeIn()` a no-op — the underlying `stopSpeaking()` behaviour is unchanged.',
    default: true,
    keys: BARGE_IN_TOAST_FLAG_KEYS,
    isEnabled: isBargeInToastEnabled,
    telemetry: ['voice_barge_in_notified'],
    testId: 'voice-barge-in',
    specDocs: [
      'docs/Chat V9/VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm4',
      'docs/Chat V9/CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md',
    ],
  },
  {
    id: 'voice-mode-legend',
    ticket: 'VM3',
    block: 'voice',
    title: 'Voice modes legend popover',
    description:
      'Small "?" affordance next to the mic button in `EnhancedChatInput` that opens a popover explaining the two mic modes the UI exposes today (Dictation vs Conversation-live). Kill-switch: when off, the trigger button is hidden entirely — the mic button is unaffected. Intended to reduce "voice does not do what I thought it would" support tickets.',
    default: true,
    keys: VOICE_MODE_LEGEND_FLAG_KEYS,
    isEnabled: isVoiceModeLegendEnabled,
    telemetry: ['voice_mode_legend_opened'],
    testId: 'voice-mode-legend-trigger',
    specDocs: [
      'docs/Chat V9/VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm3',
      'docs/Chat V9/CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md',
    ],
  },
  {
    id: 'voice-legend-shortcut',
    ticket: 'VM3.1',
    block: 'voice',
    title: 'Voice modes legend keyboard shortcut',
    description:
      'Global Alt+Shift+V (Option+Shift+V on macOS) opens the voice-modes legend popover from anywhere in the app by dispatching a `chat-v9-voice-legend:open` CustomEvent. Listener short-circuits when focus is in an editable element or when a modal (`aria-modal="true"`) is open, so the chord cannot hijack typing. Independent from `voice-mode-legend` (VM3): flipping this kill-switch drops the shortcut without hiding the help button. Paired with NAV-M1.1 (Alt+Shift+C) to start a consistent Alt+Shift+<letter> action family.',
    default: true,
    keys: VOICE_LEGEND_SHORTCUT_FLAG_KEYS,
    isEnabled: isVoiceLegendShortcutEnabled,
    telemetry: ['voice_mode_legend_shortcut'],
    testId: null,
    specDocs: ['docs/Chat V9/VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm3-1'],
  },
  {
    id: 'voice-legend-copy-text',
    ticket: 'VM3.2',
    block: 'voice',
    title: 'Voice legend · "Copy legend" button',
    description:
      'VM3.2: adds a small `Copy` button in the `VoiceModeLegend` popover footer. Produces a deterministic, dependency-free Markdown-ish payload (`buildVoiceLegendCopyText`) that mirrors whichever layout the popover is currently showing — two-mode (Dictation / Conversation live) OR the VM1-lite "voice is unavailable" message. The button owns an idle → copied → idle (or idle → failed → idle) transient feedback window; closing the popover resets the feedback so the next open starts clean. Zero telemetry; `voice_mode_legend_opened` already tracks intent, whether the user then copies is refinement. Kill-switch OFF removes the button and the copy handler; the popover is pixel-identical to the pre-VM3.2 build.',
    default: true,
    keys: VOICE_LEGEND_COPY_TEXT_FLAG_KEYS,
    isEnabled: isVoiceLegendCopyTextEnabled,
    telemetry: [],
    testId: 'voice-mode-legend-copy',
    specDocs: ['docs/Chat V9/VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm3-2'],
  },
  {
    id: 'voice-funnel-telemetry',
    ticket: 'VM10',
    block: 'voice',
    title: 'Voice funnel telemetry emits',
    description:
      'Emits `voice_start` / `voice_stt_success` / `voice_stt_fail` / `tts_on` from `useUniversalVoice`. RODO-safe closed-enum payloads: transcript text is collapsed to a length bucket, STT/TTS errors map to a fixed reason enum. Kill-switch: when off, `emit*()` helpers are no-ops — voice STT / TTS behaviour is untouched. Paired with VM4 (`voice_barge_in_notified`) for the full voice funnel.',
    default: true,
    keys: VOICE_FUNNEL_TELEMETRY_FLAG_KEYS,
    isEnabled: isVoiceFunnelTelemetryEnabled,
    telemetry: ['voice_start', 'voice_stt_success', 'voice_stt_fail', 'tts_on'],
    testId: null,
    specDocs: [
      'docs/Chat V9/VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm10',
      'docs/Chat V9/CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md',
    ],
  },
  {
    id: 'private-mode-details',
    ticket: 'T-PM1',
    block: 'trust',
    title: 'Private mode details popover',
    description:
      'Turns the existing "Private mode" badge in `UnifiedChatPanel` into a button that opens a short explainer popover: what private mode DOES disable (long-term memory, personalisation), what still happens (messages still reach the model, operational logs retained without content), and how to exit. Kill-switch: when off, the component falls back to the legacy read-only chip — privacy behaviour is identical. Trust / explainability surface only; does NOT change `aiConfig.privateMode`.',
    default: true,
    keys: PRIVATE_MODE_DETAILS_FLAG_KEYS,
    isEnabled: isPrivateModeDetailsEnabled,
    telemetry: ['private_mode_details_opened'],
    testId: 'private-mode-badge-trigger',
    specDocs: [
      'docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-pm1',
      'docs/Chat V9/CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md#private_mode_details_opened',
    ],
  },
  {
    id: 'back-to-chat-button',
    ticket: 'NAV-M1',
    block: 'navigation',
    title: 'Back-to-chat floating button',
    description:
      'Small fixed-position pill mounted at the App root that takes the user back to the active conversation whenever `currentView !== AI_CHAT / WELCOME` AND `activeConversationId` is set. Wraps the existing `returnToFullChat()` action — does not define its own navigation behaviour. Kill-switch: when off the button returns null and users fall back to the sidebar / browser back / per-module headers.',
    default: true,
    keys: BACK_TO_CHAT_BUTTON_FLAG_KEYS,
    isEnabled: isBackToChatButtonEnabled,
    telemetry: ['navigation_back_to_chat_clicked'],
    testId: 'back-to-chat-button',
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m1',
      'docs/Chat V9/CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md#navigation_back_to_chat_clicked',
    ],
  },
  {
    id: 'back-to-chat-shortcut',
    ticket: 'NAV-M1.1',
    block: 'navigation',
    title: 'Back-to-chat keyboard shortcut',
    description:
      "Headless global `keydown` listener mounted at the App root. Alt+Shift+C (macOS Option+Shift+C) triggers the same `returnToFullChat()` action as NAV-M1's button, using the same view / conversation gates plus an editable-focus / open-modal guard so the shortcut never hijacks typing or cancels a confirm dialog. Kill-switch: when off the listener is detached entirely; the NAV-M1 button remains as the visible affordance.",
    default: true,
    keys: BACK_TO_CHAT_SHORTCUT_FLAG_KEYS,
    isEnabled: isBackToChatShortcutEnabled,
    telemetry: ['navigation_back_to_chat_shortcut'],
    testId: null,
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m1-1',
      'docs/Chat V9/CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md#navigation_back_to_chat_shortcut',
    ],
  },
  {
    id: 'workspace-breadcrumb',
    ticket: 'NAV-M2',
    block: 'navigation',
    title: 'Workspace breadcrumb pill',
    description:
      'Floating `Chat › <view label>` pill rendered at top-center on non-chat workspace views when the user has an active conversation. Pure wayfinding affordance — the `Chat` segment is a button that calls the same `returnToFullChat()` as NAV-M1, so the three "get me back" surfaces (button top-right, keyboard Alt+Shift+C, breadcrumb top-center) all agree. The label comes from a small curated `AppView` → string map with a deterministic humaniser fallback; unmapped views render as `Title Case · Rest` without touching the enum. Kill-switch: OFF returns `null` pixel-for-pixel; the component never paints. No telemetry — NAV-M1\'s `navigation_back_to_chat_clicked` already covers the "user returned to chat" signal.',
    default: true,
    keys: WORKSPACE_BREADCRUMB_FLAG_KEYS,
    isEnabled: isWorkspaceBreadcrumbEnabled,
    telemetry: [],
    testId: 'workspace-breadcrumb',
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m2-lite',
    ],
  },
  {
    id: 'workspace-breadcrumb-conversation',
    ticket: 'NAV-M2.1',
    block: 'navigation',
    title: 'Workspace breadcrumb · conversation title segment',
    description:
      'NAV-M2-lite+ extension of the workspace breadcrumb pill: when the active conversation has a non-empty title, append it as a third `current` segment (`Chat › <view> › <conversation title>`) and demote the view segment to `view`. Title is read from `useConversationStore`, trimmed, and truncated to 32 chars with a `…` suffix (full text surfaces via the `title=` attribute tooltip). Pure wayfinding — no telemetry, no navigation side effects; the conversation-title segment is non-interactive. Kill-switch OFF collapses the pill back to the NAV-M2-lite two-segment shape, and the base `ff.workspace_breadcrumb` remains the outer safety net.',
    default: true,
    keys: WORKSPACE_BREADCRUMB_CONVERSATION_FLAG_KEYS,
    isEnabled: isWorkspaceBreadcrumbConversationEnabled,
    telemetry: [],
    testId: 'workspace-breadcrumb',
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m2-lite-plus',
    ],
  },
  {
    id: 'workspace-breadcrumb-recents',
    ticket: 'NAV-M3',
    block: 'navigation',
    title: 'Workspace breadcrumb · recent conversations dropdown',
    description:
      'NAV-M3-lite: adds a small caret button next to the `Chat` segment of the workspace breadcrumb pill. Clicking it opens a popover listing the 5 most-recent non-active, non-archived, non-deleted conversations (as filtered / sorted by `buildRecentConversationsList`, keyed on `lastMessageAt` with `updatedAt` fallback). Selecting an entry calls `setActiveConversation(id)` and then the existing `returnToFullChat()` verb, so the user lands in the chosen chat at the main surface — same landing spot as NAV-M1 / NAV-M1.1 / NAV-M2-lite. Escape or outside-click closes the popover; no telemetry fires because the existing navigation-back-to-chat signal already covers the "returned to chat" event. Kill-switch OFF hides the caret entirely and the breadcrumb collapses back to the NAV-M2.1 shape.',
    default: true,
    keys: WORKSPACE_BREADCRUMB_RECENTS_FLAG_KEYS,
    isEnabled: isWorkspaceBreadcrumbRecentsEnabled,
    telemetry: [],
    testId: 'workspace-breadcrumb',
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m3-lite',
    ],
  },
  {
    id: 'workspace-breadcrumb-recents-view-all',
    ticket: 'NAV-M3.2',
    block: 'navigation',
    title: 'Workspace breadcrumb · "View all" footer in recents',
    description:
      "NAV-M3-lite++ extension of the recent-conversations dropdown: when the eligible recents count (`countEligibleRecentConversations`) exceeds the popover's 5-row cap, a non-`menuitem` footer row renders below the last sibling with a hairline separator above it. Clicking it calls `returnToFullChat()` and, only if the conversations sidebar was closed, `toggleSidebar()` — so the user lands on the main chat surface with the full conversation list ready to scan. When the eligible count fits in the cap, the footer is suppressed (pointing users at a sidebar list identical to what they saw is dead UX). Zero new telemetry; same signal family as NAV-M3. Kill-switch OFF never renders the footer and the eligibility counter is skipped entirely.",
    default: true,
    keys: WORKSPACE_BREADCRUMB_RECENTS_VIEW_ALL_FLAG_KEYS,
    isEnabled: isWorkspaceBreadcrumbRecentsViewAllEnabled,
    telemetry: [],
    testId: 'workspace-breadcrumb',
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m3-lite-plus-plus',
    ],
  },
  {
    id: 'workspace-breadcrumb-recents-pinned',
    ticket: 'NAV-M3.1',
    block: 'navigation',
    title: 'Workspace breadcrumb · pinned conversations first',
    description:
      'NAV-M3-lite+ extension of the recent-conversations dropdown: when an entry\'s upstream `Conversation.starred` or `Conversation.isPinned` is `true`, `buildRecentConversationsList` marks it `pinned=true` and bubbles it above non-pinned rows while preserving newest-first order within both groups. The dropdown renders a small `★` glyph left of the title and exposes `aria-label="Pinned: <full title>"` for screen readers; a `data-pinned` attribute keeps it scriptable. Total cap stays at 5 entries — pins compete for the same slots, which is intentional (a user with 5+ pins has already told us those are the only threads worth showing). Zero new telemetry; the existing `returnToFullChat()` path still covers the land-in-chat signal. Kill-switch OFF drops the glyph and collapses ordering back to pure chronological (NAV-M3-lite v1 shape), and the base `ff.workspace_breadcrumb_recents` remains the outer safety net.',
    default: true,
    keys: WORKSPACE_BREADCRUMB_RECENTS_PINNED_FLAG_KEYS,
    isEnabled: isWorkspaceBreadcrumbRecentsPinnedEnabled,
    telemetry: [],
    testId: 'workspace-breadcrumb',
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m3-lite-plus',
    ],
  },
  {
    id: 'next-model-chip',
    ticket: 'C-IN1',
    block: 'input',
    title: 'Next-message model hint chip',
    description:
      'Compact read-only pill in the `EnhancedChatInput` action bar that displays `"→ <model>"`, telegraphing which model will handle the next send. Symmetric with the post-reply Trust Badge (which tells the user what *did* run). Zero side effects: never mutates `aiConfig`, never hits the network, never fires telemetry (the existing `ai_model_changed` event already covers model switches). Kill-switch: when off the chip returns null and the action bar collapses normally — the `ModelSelector` dropdown is the unchanged canonical way to switch models.',
    default: true,
    keys: NEXT_MODEL_CHIP_FLAG_KEYS,
    isEnabled: isNextModelChipEnabled,
    telemetry: [],
    testId: 'next-model-chip',
    specDocs: ['docs/Chat V9/INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md#c-in1'],
  },
  {
    id: 'input-char-counter',
    ticket: 'C-IN2',
    block: 'input',
    title: 'Input character counter pill',
    description:
      'Compact read-only pill in the `EnhancedChatInput` action bar that stays invisible until the composed message crosses a soft threshold (default 400 chars), then shows `N / max` (default 8000) with colour escalation: slate → amber at 80% of max → rose at or above max. Advisory only — never blocks Send. Zero telemetry (a keystroke-rate emission would be pathological). Kill-switch: when off the pill never mounts and the textarea is unchanged.',
    default: true,
    keys: INPUT_CHAR_COUNTER_FLAG_KEYS,
    isEnabled: isInputCharCounterEnabled,
    telemetry: [],
    testId: 'input-char-counter',
    specDocs: ['docs/Chat V9/INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md#c-in2'],
  },
  {
    id: 'input-hint-strip',
    ticket: 'C-IN4',
    block: 'input',
    title: 'Input keyboard-hint strip',
    description:
      'Compact passive strip under `EnhancedChatInput` showing the three keyboard affordances that cover 99% of composing: `Enter ↲ send · Shift+Enter newline · Esc clear`. Rendered with `aria-hidden` because textareas already expose those keys to assistive tech; the strip exists purely to stop repeated "how do I add a paragraph break?" questions from new users. Non-focusable, no callbacks, no telemetry. Kill-switch restores the pre-C-IN4-lite layout pixel-for-pixel.',
    default: true,
    keys: INPUT_HINT_STRIP_FLAG_KEYS,
    isEnabled: isInputHintStripEnabled,
    telemetry: [],
    testId: 'chat-v9-input-hint-strip',
    specDocs: ['docs/Chat V9/INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md#c-in4-lite'],
  },
  {
    id: 'trust-badge',
    ticket: 'T-TR1',
    block: 'trust',
    title: 'AI response trust badge',
    description:
      'Renders a compact always-visible chip beneath every non-streaming AI reply: citation count ("3 sources" / "No cited sources") plus optional model name. Clicking opens a popover with the first 5 citation titles and an honest "sources tell you what was retrieved, always verify claims" disclaimer. Read-only surface; never mutates the message, never refetches, never talks to the backend. Kill-switch: when off the component returns null — the existing `CitationList` and WIP `TrustPanel` stubs are unaffected.',
    default: true,
    keys: TRUST_BADGE_FLAG_KEYS,
    isEnabled: isTrustBadgeEnabled,
    telemetry: ['trust_badge_opened'],
    testId: 'trust-badge-trigger',
    specDocs: [
      'docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr1',
      'docs/Chat V9/CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md#trust_badge_opened',
    ],
  },
  {
    id: 'trust-badge-humanize-model',
    ticket: 'T-TR1.2',
    block: 'trust',
    title: 'Trust Badge model label humanizer',
    description:
      'Runs `msg.metadata.modelUsed` through a pure dictionary + heuristic formatter before the Trust Badge renders it. Turns raw identifiers (`gpt-4o-2024-08-06`, `claude-3-5-sonnet-20241022`, private uuids) into human-friendly labels (`GPT-4o`, `Claude 3.5 Sonnet`, `Private model`), clipped at 32 characters. Also surfaces an "Answered by <model>" line inside the badge popover. Pure read-side: never mutates the message, never hits the network, never emits telemetry (the existing `trust_badge_opened` payload already reports `hasModel` as a boolean). Kill-switch: when off the badge falls back to its shipped T-TR1 behaviour (raw trimmed id, no popover "Answered by" line).',
    default: true,
    keys: TRUST_BADGE_HUMANIZE_MODEL_FLAG_KEYS,
    isEnabled: isTrustBadgeHumanizeModelEnabled,
    telemetry: [],
    testId: 'trust-badge-answered-by',
    specDocs: ['docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr1-2'],
  },
  {
    id: 'trust-badge-copy-citations',
    ticket: 'T-TR1.3',
    block: 'trust',
    title: 'Trust Badge copy citations button',
    description:
      'Renders a small "Copy" button in the footer of the Trust Badge popover. On click, serialises the citation list (plus the humanised model label when T-TR1.2 is ON) to a deterministic Markdown block — numbered titles, `[title](link)` for cited URLs, ` — ref:<reference>` suffix when present — and writes it to the system clipboard via the shared `copyTextToClipboard` helper. Three transient states (`Copy` → `Copied` / `Copy failed`) mirror AG1 v1.2 so the two ops affordances feel consistent. Hidden when there are no citations; the popover otherwise behaves identically to T-TR1.',
    default: true,
    keys: TRUST_BADGE_COPY_CITATIONS_FLAG_KEYS,
    isEnabled: isTrustBadgeCopyCitationsEnabled,
    telemetry: [],
    testId: 'trust-badge-copy-citations',
    specDocs: ['docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr1-3'],
  },
  {
    id: 'trust-badge-reasoning',
    ticket: 'T-TR2',
    block: 'trust',
    title: 'Trust Badge "Why this answer?" reasoning snippet',
    description:
      'Collapsible disclosure rendered inside the Trust Badge popover between the source list and the verify-claims disclaimer footer. Clicking "Why this answer?" expands a deterministic 3-item snippet derived purely from the same (citationCount, modelLabel) pair the trigger pill already uses: a retrieval observation (`retrieval-strong` / `retrieval-some` / `retrieval-none` based on the T-TR1 bucket thresholds), a model observation (`model-known` / `model-unknown`), and an always-present "Always verify" reminder so the disclosure never ends on a smug signal. No telemetry — `trust_badge_opened` (T-TR1) already captures engagement with the popover. Kill-switch removes the toggle + body entirely; the popover collapses back to the T-TR1.3 layout pixel-for-pixel.',
    default: true,
    keys: TRUST_BADGE_REASONING_FLAG_KEYS,
    isEnabled: isTrustBadgeReasoningEnabled,
    telemetry: [],
    testId: 'trust-badge-reasoning',
    specDocs: ['docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr2'],
  },
  {
    id: 'trust-badge-copy-reasoning',
    ticket: 'T-TR1.4',
    block: 'trust',
    title: 'Trust Badge "Copy reasoning" button',
    description:
      'T-TR1.4: mirrors the T-TR1.3 "Copy citations" affordance but exports the T-TR2 "Why this answer?" observations as a deterministic Markdown block (`buildTrustBadgeReasoningText` — header line + numbered `N. <headline> — <body>` list, humanised model label suffix when available). The button renders inside the T-TR2 disclosure body (and only when the disclosure is expanded), reuses the existing `writeToClipboard` seam + `CopyFeedback` state pattern from T-TR1.3, and drives its own `idle → copied → idle` / `idle → failed → idle` transition so the two copy buttons never clobber each other. Kill-switch OFF removes the button entirely; the disclosure behaves exactly as it did before T-TR1.4.',
    default: true,
    keys: TRUST_BADGE_COPY_REASONING_FLAG_KEYS,
    isEnabled: isTrustBadgeCopyReasoningEnabled,
    telemetry: [],
    testId: 'trust-badge-copy-reasoning',
    specDocs: ['docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr14'],
  },
  {
    id: 'trust-badge-citation-links',
    ticket: 'T-TR3',
    block: 'trust',
    title: 'Trust Badge per-citation clickable link',
    description:
      'T-TR3-lite: linkify each citation row inside the Trust Badge popover when the citation has a `link` that passes `isSafeCitationLink` (http/https absolute URL, non-empty host, no `javascript:` / `data:` / `file:` / `blob:` schemes). Rendered as `<a target="_blank" rel="noopener noreferrer">` so the user never loses the chat surface when auditing a source; `aria-label` reads "Open source in a new tab: <title>". Citations without a safe link continue to render as plain text, so the kill-switch only governs whether the linkification path is allowed to activate — untrusted / absent links always degrade to the pre-T-TR3-lite plain-text behaviour. Kill-switch OFF removes every `<a>` from the popover pixel-for-pixel.',
    default: true,
    keys: TRUST_BADGE_CITATION_LINKS_FLAG_KEYS,
    isEnabled: isTrustBadgeCitationLinksEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr3-lite',
    ],
  },
  {
    id: 'trust-badge-citation-domain',
    ticket: 'T-TR3.4',
    block: 'trust',
    title: 'Trust Badge citation row · domain pill',
    description:
      'T-TR3.4: renders a small secondary pill after every citation title in the Trust Badge popover showing the hostname of the source URL, stripped of a leading `www.` (e.g. `nytimes.com`, `wikipedia.org`). The pill is a provenance signal that complements the T-TR3-lite clickable-link path but is deliberately INDEPENDENT of it — tenants that keep citations non-interactive (T-TR3-lite OFF) still benefit from a visible source hint. Extraction goes through the `extractCitationDomain` pure helper, which accepts `http:` and `https:` only and rejects `javascript:` / `data:` / `blob:` / `file:` / `about:` / `vbscript:` prefixes so a stray unsafe URL cannot smuggle a rendered payload into the popover. Citations with missing / unparsable / non-http(s) links render no pill — silent degrade. Kill-switch OFF removes the `<span data-testid="trust-badge-citation-domain-*">` for every row; layout is pixel-identical to pre-T-TR3.4. Zero telemetry.',
    default: true,
    keys: TRUST_BADGE_CITATION_DOMAIN_FLAG_KEYS,
    isEnabled: isTrustBadgeCitationDomainEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr34'],
  },
  {
    id: 'pii-heuristic-toast',
    ticket: 'T-PM2',
    block: 'trust',
    title: 'Post-send PII heuristic warning toast',
    description:
      'Advisory nudge shown after the user sends a message that looks like it contains personal data. `EnhancedChatInput.handleSend` dispatches a `chat-v9-pii-check` CustomEvent with the outgoing text; a headless `PiiHeuristicToast` component mounted at the App root runs the pure `detectPiiCategories()` detector (email / phone / IBAN) and, when any category hits, emits a neutral `react-hot-toast` warning plus a PII-free `pii_heuristic_warning_shown` telemetry event whose only payload field is the closed-enum category array. A 4s cooldown keeps rapid follow-up sends from stacking warnings. Kill-switch detaches the listener entirely — the dispatch becomes a no-op, no detector runs, no telemetry fires.',
    default: true,
    keys: PII_HEURISTIC_TOAST_FLAG_KEYS,
    isEnabled: isPiiHeuristicToastEnabled,
    telemetry: ['pii_heuristic_warning_shown'],
    testId: null,
    specDocs: [
      'docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-pm2-lite',
    ],
  },
  {
    id: 'pii-heuristic-session-dismiss',
    ticket: 'T-PM2.1',
    block: 'trust',
    title: 'PII toast · "Don\'t show again this session" action',
    description:
      "T-PM2-lite v1.1 extension: the PII heuristic toast grows a secondary \"Don't show again this session\" button that writes `chatV9.piiToastDismissedForSession='1'` to `sessionStorage`. Once set, the listener bails on every subsequent PII event for the lifetime of the current tab — no toast, no telemetry — so users who have already been nudged can dump a long transcript without repeated warnings. A fresh tab starts with fresh sessionStorage so the nudge comes back by default. Kill-switch OFF collapses the toast back to the T-PM2-lite v1 shape (message + `Dismiss` only).",
    default: true,
    keys: PII_HEURISTIC_SESSION_DISMISS_FLAG_KEYS,
    isEnabled: isPiiHeuristicSessionDismissEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-pm2-lite-v11',
    ],
  },
  {
    id: 'flags-snapshot-copy',
    ticket: 'AG1.2',
    block: 'admin',
    title: 'Flag snapshot copy-to-clipboard button',
    description:
      'Adds a "Copy snapshot" button to the ChatV9 admin flags panel header. Builds a deterministic Markdown table of every registered flag (ticket, id, block, state, override, default, matches-default, storage key) and writes it to the system clipboard using the async Clipboard API with a `document.execCommand(\'copy\')` fallback for non-secure contexts. The panel itself is already role-gated and reached via `?v9flags=1`; this flag exists purely so ops can kill the button in environments whose clipboard policy prompts on every write.',
    default: true,
    keys: FLAGS_SNAPSHOT_COPY_FLAG_KEYS,
    isEnabled: isFlagsSnapshotCopyEnabled,
    telemetry: [],
    testId: 'chat-v9-flags-copy-snapshot',
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v12'],
  },
  {
    id: 'flags-reset-url',
    ticket: 'AG1.3',
    block: 'admin',
    title: 'URL reset one-liner (`?v9flags=reset`)',
    description:
      'Mounts a headless handler at the App root that inspects the page URL on load. If `?v9flags=reset` is present and the user is authorised (SUPERADMIN / OWNER / ADMIN), it calls `resetAllChatV9FlagOverrides()`, rewrites the query to `?v9flags=1` via `history.replaceState` so the overlay opens as visible confirmation, and dispatches the existing `chat-v9-flags:open` CustomEvent. Unauthorised sessions still get their URL cleaned, but the write-side helper is never invoked. Kill-switch: when off the handler is a no-op and `?v9flags=reset` has no effect.',
    default: true,
    keys: FLAGS_RESET_URL_FLAG_KEYS,
    isEnabled: isFlagsResetUrlEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v13'],
  },
  {
    id: 'flags-panel-filter',
    ticket: 'AG1.5',
    block: 'admin',
    title: 'Admin flag panel filter input',
    description:
      'Adds a small search input to the ChatV9 admin flag panel sub-header. Filters visible flag rows by title, ticket, block, id, and localStorage key (case-insensitive, multi-token substring match). Empty query lists every registered flag; a no-match state explains why the list is empty without collapsing the filter row. Purely presentational — override / reset / snapshot-copy semantics are unchanged; when the kill-switch is off the input disappears and the stored query resets so flipping it back ON starts from a clean state.',
    default: true,
    keys: FLAGS_PANEL_FILTER_FLAG_KEYS,
    isEnabled: isFlagsPanelFilterEnabled,
    telemetry: [],
    testId: 'chat-v9-flags-filter-input',
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v15'],
  },
  {
    id: 'flags-panel-grouping',
    ticket: 'AG1.6',
    block: 'admin',
    title: 'Admin flag panel collapsible block groups',
    description:
      'Groups rows in the ChatV9 admin flag panel under collapsible block headers (voice / trust / admin / navigation / input) in first-seen registry order. Each header shows block name, `visible/total` count when AG1 v1.5 filter is active or just total otherwise, and an amber override-count pill when any flag in the group is overridden. Per-block collapse state is local to the component (not persisted); while a non-empty filter query is typed, every group with matches is force-expanded so admins can see hits without extra clicks. Kill-switch falls back to the pre-v1.6 flat list while keeping filter, snapshot-copy and override semantics byte-for-byte unchanged.',
    default: true,
    keys: FLAGS_PANEL_GROUPING_FLAG_KEYS,
    isEnabled: isFlagsPanelGroupingEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v16'],
  },
  {
    id: 'flags-panel-doc-links',
    ticket: 'AG1.7',
    block: 'admin',
    title: 'Admin flag panel · per-row spec-doc breadcrumb',
    description:
      "Appends a small, selectable monospace line under each flag row in the ChatV9 admin panel showing the flag's first `specDocs` entry (e.g. `docs/Chat V9/…#ag1-v1`) plus a `(+N more)` hint when the flag has multiple entries. The `title=` tooltip surfaces the full newline-joined list so deep-linked flags (plan + telemetry contract) stay discoverable on hover without expanding the row. When a flag has no spec docs, a dimmed `— no spec docs` placeholder renders so the layout stays stable and the gap is *visible*, not silently hidden. Admin-only surface, zero telemetry, zero navigation side effects. Kill-switch falls back to the pre-v1.7 row shape pixel-for-pixel.",
    default: true,
    keys: FLAGS_PANEL_DOC_LINKS_FLAG_KEYS,
    isEnabled: isFlagsPanelDocLinksEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v17'],
  },
  {
    id: 'flags-panel-description-expand',
    ticket: 'AG1.8',
    block: 'admin',
    title: 'Admin flag panel · per-flag description expansion toggle',
    description:
      "AG1 v1.8: adds a tiny `Show more` / `Show less` button below every sufficiently long flag description in `ChatV9FlagsPanel`. Collapsed rows keep the pre-v1.8 `line-clamp-3` behaviour; expanded rows drop the clamp and render the full description with preserved paragraph breaks. The toggle only renders when the description's trimmed length meets `DEFAULT_DESCRIPTION_EXPAND_THRESHOLD` (220 chars) so short descriptions never grow a pointless no-op button. Expansion state is local to the panel instance and reset on unmount — the flow is 'admin reads details, flips flag, closes overlay', not 'leave panel expanded'. Zero telemetry, zero persistence. Kill-switch OFF collapses the panel back to the v1.7 shape pixel-for-pixel.",
    default: true,
    keys: FLAGS_PANEL_DESCRIPTION_EXPAND_FLAG_KEYS,
    isEnabled: isFlagsPanelDescriptionExpandEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v18'],
  },
  {
    id: 'flags-panel-sticky-group-headers',
    ticket: 'AG1.9',
    block: 'admin',
    title: 'Admin flag panel · sticky block-group headers',
    description:
      'AG1 v1.9: when the AG1 v1.6 grouping flag is ON, each block-group header (`navigation`, `trust`, `voice`, `control`, `input`, `admin`, `context`) now sticks to the top of the `ChatV9FlagsPanel` scroll container. Admins keep the block label + override badge + expand chevron in view while scrolling through a long, filtered list, so context never gets lost between two-dozen navigation flags. The header gains `position: sticky; top: 0; z-index: 10` plus an opaque background and a 1 px bottom shadow so row content below never bleeds through while the header is pinned. When grouping is OFF (flat list) the flag is moot; when the sticky kill-switch itself is OFF, headers scroll normally and the panel looks pixel-for-pixel identical to AG1 v1.6 v1. Zero telemetry, zero persistence.',
    default: true,
    keys: FLAGS_PANEL_STICKY_GROUP_HEADERS_FLAG_KEYS,
    isEnabled: isFlagsPanelStickyGroupHeadersEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v19'],
  },
  {
    id: 'flags-panel-row-shortcuts',
    ticket: 'AG1.10',
    block: 'admin',
    title: 'Admin flag panel · per-row keyboard shortcuts (o/f/d)',
    description:
      'AG1 v1.10: while focus is inside any flag row in `ChatV9FlagsPanel`, lowercase `o` flips the override to ON, `f` flips it to OFF, and `d` clears the override back to the shipped default — the same three operations admins can already reach via the buttons on that row. The row handler ignores any keypress with a modifier (`⌘` / `Ctrl` / `Alt` / `Shift`) and refuses to hijack typing inside an `<input>`, `<textarea>`, `<select>`, or `contenteditable` surface, so the filter input (AG1 v1.5), a future inline annotation field, or browser find (`⌘F`) keep working. The three toggle buttons gain matching `aria-keyshortcuts` attributes (`o`, `f`, `d`) so screen readers announce the shortcut the same way they would announce a menu accelerator. Zero telemetry. Kill-switch OFF removes both the keydown handler and the `aria-keyshortcuts` attributes so the DOM matches the pre-AG1-v1.10 build pixel-for-pixel.',
    default: true,
    keys: FLAGS_PANEL_ROW_SHORTCUTS_FLAG_KEYS,
    isEnabled: isFlagsPanelRowShortcutsEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v110'],
  },
  {
    id: 'flags-panel-shortcut-cheat-sheet',
    ticket: 'AG1.11',
    block: 'admin',
    title: 'Admin flag panel · header shortcut cheat-sheet pill',
    description:
      "AG1 v1.11: renders a small `Shortcuts · o ON · f OFF · d default` pill under the panel heading in `ChatV9FlagsPanel`, advertising the AG1 v1.10 per-row shortcuts to admins who don't read release notes. Each letter is wrapped in a `<kbd>` element so assistive tech announces it as an accelerator and the pill reads the same way a menu would render a keyboard shortcut. The pill only renders when BOTH AG1 v1.10 AND this kill-switch are ON — flipping either one OFF hides the hint, so the panel never advertises a shortcut the handler is not serving. Zero telemetry, zero layout reflow outside the header.",
    default: true,
    keys: FLAGS_PANEL_SHORTCUT_CHEAT_SHEET_FLAG_KEYS,
    isEnabled: isFlagsPanelShortcutCheatSheetEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v111'],
  },
  {
    id: 'flags-panel-filter-escape-clear',
    ticket: 'AG1.13',
    block: 'admin',
    title: 'Admin flag panel · Escape clears the filter input',
    description:
      'AG1 v1.13: when the AG1 v1.5 filter input has focus AND contains text, pressing `Escape` clears the text in place rather than bubbling to the overlay. Matches APG search-input convention — one-keystroke undo for a filter typo without dismissing the whole panel. When the input is empty, `Escape` is deliberately NOT handled, so the overlay keeps its one-keystroke close for admins who want to exit the panel without first blurring the filter. Advertised as an accelerator via `aria-keyshortcuts="Escape"` only while the behaviour is live. Kill-switch OFF restores the pre-AG1-v1.13 bubble-through behaviour pixel-for-pixel; tests inject `isFilterEscapeClearEnabled={() => false}` to pin that path.',
    default: true,
    keys: FLAGS_PANEL_FILTER_ESCAPE_CLEAR_FLAG_KEYS,
    isEnabled: isFlagsPanelFilterEscapeClearEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v113'],
  },
  {
    id: 'flags-panel-override-url-copy',
    ticket: 'AG1.12',
    block: 'admin',
    title: 'Admin flag panel · "Copy override URL" button',
    description:
      "AG1 v1.12: adds a second header button next to the AG1 v1.2 snapshot copy that writes a shareable URL encoding every current override as `?<flag.keys.query>=0|1`. When an admin opens that URL in any browser, Chat V9's standard URL-first resolution path reproduces their exact override set for that tab. Emits overrides in `CHAT_V9_FLAGS` registry order for deterministic, diffable URLs; preserves any non-`ff_*` query params already in the tab (e.g. `?tenant=acme`); skips flags that match their shipped default so the URL stays lean. Button is disabled when `overridesCount === 0` so a no-op URL never lands on the clipboard. Kill-switch OFF removes both the button and the handler; the header layout is pixel-identical to the pre-AG1-v1.12 build. Zero telemetry.",
    default: true,
    keys: FLAGS_PANEL_OVERRIDE_URL_COPY_FLAG_KEYS,
    isEnabled: isFlagsPanelOverrideUrlCopyEnabled,
    telemetry: [],
    testId: 'chat-v9-flags-copy-override-url',
    specDocs: ['docs/Chat V9/ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v112'],
  },
  {
    id: 'workspace-breadcrumb-recents-arrow-keys',
    ticket: 'NAV-M3.3',
    block: 'navigation',
    title: 'Workspace breadcrumb · recents dropdown arrow-key navigation',
    description:
      "NAV-M3-lite^3: turns the `RecentConversationsDropdown` menuitem ring into a roving-focus control. When the popover is open, ArrowDown / ArrowUp wrap focus through the rows, Home / End jump to the first / last entry, and Tab closes the popover so focus hands back to the natural Tab order above the trigger. Enter / Space continue to activate the focused item via the native button semantics (no synthetic key handler, no preventDefault). Auto-focus on open (NAV-M3-lite v1) is preserved. The 'View all' footer stays reachable via Tab but is deliberately outside the roving ring, matching the ARIA authoring practices recommendation for 'menu' widgets. Zero telemetry, zero layout change. Kill-switch OFF reverts to the NAV-M3-lite v1 Tab-only navigation pixel-for-pixel.",
    default: true,
    keys: WORKSPACE_BREADCRUMB_RECENTS_ARROW_KEYS_FLAG_KEYS,
    isEnabled: isWorkspaceBreadcrumbRecentsArrowKeysEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m3-lite-v3',
    ],
  },
  {
    id: 'workspace-breadcrumb-recents-trigger-arrow',
    ticket: 'NAV-M3.4',
    block: 'navigation',
    title: 'Workspace breadcrumb · recents trigger ArrowDown shortcut',
    description:
      'NAV-M3.4: ARIA-APG menu-button shortcut on the `RecentConversationsDropdown` trigger. When the trigger is focused and the popover is closed, pressing ArrowDown opens the popover and lets NAV-M3-lite v1\'s open-effect auto-focus the first menuitem — one keystroke instead of Tab + Enter. `event.preventDefault()` suppresses the native page-scroll. The trigger advertises the affordance declaratively via `aria-keyshortcuts="ArrowDown"` so screen readers and keyboard-help overlays can announce it. Enter / Space continue to open the popover through the native `<button>` activation path. Kill-switch OFF removes the handler and the `aria-keyshortcuts` attribute; the trigger behaves like a plain button again (NAV-M3-lite v1 behaviour pixel-for-pixel).',
    default: true,
    keys: WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_FLAG_KEYS,
    isEnabled: isWorkspaceBreadcrumbRecentsTriggerArrowEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m34',
    ],
  },
  {
    id: 'workspace-breadcrumb-recents-trigger-arrow-up',
    ticket: 'NAV-M3.5',
    block: 'navigation',
    title: 'Workspace breadcrumb · recents trigger ArrowUp shortcut',
    description:
      'NAV-M3.5: mirror of NAV-M3.4 on the opposite side. When the recents-dropdown caret trigger is focused and the popover is closed, pressing ArrowUp opens the popover AND lands focus on the **last** menuitem — matching the ARIA-APG menu-button pattern where ArrowDown opens to the top and ArrowUp opens to the bottom. `event.preventDefault()` suppresses the native page-scroll. When both NAV-M3.4 and NAV-M3.5 are ON the trigger\'s `aria-keyshortcuts` advertises `"ArrowDown ArrowUp"`; when only one is ON only that shortcut is advertised; with both OFF the attribute is omitted and the trigger reverts to click-only semantics. The existing roving-focus handler (NAV-M3-lite^3) then takes over for all subsequent in-popover navigation. Kill-switch OFF removes the ArrowUp branch from the trigger handler and drops `ArrowUp` from the advertised shortcut string — no other behaviour changes.',
    default: true,
    keys: WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_UP_FLAG_KEYS,
    isEnabled: isWorkspaceBreadcrumbRecentsTriggerArrowUpEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m35',
    ],
  },
  {
    id: 'input-soft-limit-toast',
    ticket: 'C-IN6',
    block: 'input',
    title: 'Input soft-limit inline toast (rose threshold nudge)',
    description:
      'C-IN6-lite: one-shot `toast.custom` fired the first time the C-IN2 `InputCharCounter` crosses its rose threshold (`value.length >= max`, default 8000 chars) in a browser tab. The toast renders a calm nudge — "Teresa may trim or summarise long inputs; shorten if every line matters" — with a "Don\'t show again this session" button modelled on T-PM2.1 that writes `chatV9.inputSoftLimitToastDismissedForSession = \'1\'` to sessionStorage. A separate `chatV9.inputSoftLimitToastFiredForSession` sentinel guarantees at-most-once-per-tab firing even without an explicit dismiss, so the pill stays the primary signal for sustained over-limit composition. Detector runs only on the rising edge (`prev < max && curr >= max`) so typing past the limit does not re-fire per keystroke. Kill-switch OFF = pure no-op; the counter colouring is unchanged. Zero telemetry, never blocks Send.',
    default: true,
    keys: INPUT_SOFT_LIMIT_TOAST_FLAG_KEYS,
    isEnabled: isInputSoftLimitToastEnabled,
    telemetry: [],
    testId: null,
    specDocs: ['docs/Chat V9/INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md#c-in6-lite'],
  },
] as const;

export interface ChatV9FlagSnapshotEntry {
  readonly id: string;
  readonly ticket: string;
  readonly block: ChatV9Block;
  readonly enabled: boolean;
  readonly default: boolean;
  readonly matchesDefault: boolean;
}

/**
 * Returns the current resolved state of every registered flag. Safe to call
 * from SSR — each resolver falls back to the hardcoded default when `window`
 * is unavailable. The admin runbook uses this shape to render a "what's on in
 * this browser right now?" dashboard.
 */
export function getChatV9FlagSnapshot(): ChatV9FlagSnapshotEntry[] {
  return CHAT_V9_FLAGS.map((flag) => {
    const enabled = flag.isEnabled();
    return {
      id: flag.id,
      ticket: flag.ticket,
      block: flag.block,
      enabled,
      default: flag.default,
      matchesDefault: enabled === flag.default,
    };
  });
}

export function findChatV9Flag(id: string): ChatV9FlagDescriptor | undefined {
  return CHAT_V9_FLAGS.find((f) => f.id === id);
}

/**
 * Returns the flags that are currently **overridden** away from their default
 * value in this browser. Intended for the owner runbook: "what did someone
 * flip?". When the array is empty, the session matches the shipped defaults.
 */
export function getChatV9FlagOverrides(): ChatV9FlagSnapshotEntry[] {
  return getChatV9FlagSnapshot().filter((entry) => !entry.matchesDefault);
}

// ---------------------------------------------------------------------------
// AG1 v1 write-side helpers
// ---------------------------------------------------------------------------
// The per-flag `src/utils/<name>Flag.ts` helpers are *read* helpers: they
// resolve the current state but never write. AG1 v1 (AI Control Hub page)
// needs write-side: clicking a toggle must flip `localStorage["ff.<key>"]`
// without a redeploy. These helpers live here so the Hub does not reach
// directly into individual flag files — that would be N places to touch when
// we add a new flag.
//
// SSR-safety note: every write is guarded. Private-mode browsers that reject
// `localStorage` writes get a silent fallback — the next `isEnabled()` call
// falls through to env / default, exactly as designed.
// ---------------------------------------------------------------------------

/**
 * The three states AG1 exposes per flag in the hub UI. We keep `null` meaning
 * "no override, resolve via env / default" because that is what the reader
 * contract treats as "not set".
 */
export type ChatV9FlagOverrideState = 'on' | 'off' | null;

function writeLocalStorage(key: string, value: '1' | '0' | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the raw override state for a flag — ignoring URL query and env. Used
 * by the hub UI to render the "Override ON / Override OFF / Default" badge
 * distinctly from `isEnabled()`, which collapses all three sources.
 */
export function getChatV9FlagOverrideState(id: string): ChatV9FlagOverrideState {
  const flag = findChatV9Flag(id);
  if (!flag) return null;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(flag.keys.localStorage);
    if (raw === '1' || raw === 'true') return 'on';
    if (raw === '0' || raw === 'false') return 'off';
    return null;
  } catch {
    return null;
  }
}

/**
 * Sets the localStorage override for a flag. `'on'` / `'off'` mirrors the
 * runbook cheat-sheet commands; pass `null` to clear the override and fall
 * back to env / default.
 *
 * Returns `true` on success, `false` when the environment rejects the write
 * (SSR, private-mode quota) — callers should surface this in the UI so the
 * admin knows their click did not stick.
 */
export function setChatV9FlagOverride(id: string, next: ChatV9FlagOverrideState): boolean {
  const flag = findChatV9Flag(id);
  if (!flag) return false;
  if (next === null) {
    return writeLocalStorage(flag.keys.localStorage, null);
  }
  return writeLocalStorage(flag.keys.localStorage, next === 'on' ? '1' : '0');
}

/**
 * Clears a single override. Equivalent to `setChatV9FlagOverride(id, null)`
 * but reads more clearly at the call site ("reset this flag to its default").
 */
export function clearChatV9FlagOverride(id: string): boolean {
  return setChatV9FlagOverride(id, null);
}

/**
 * Clears overrides for *every* registered V9 flag in one call. The hub uses
 * this as the "Reset to defaults" escape hatch. Returns the number of
 * successful clears so the UI can show a toast with accurate count — partial
 * success is possible if a single key collides with quota.
 */
export function resetAllChatV9FlagOverrides(): number {
  let cleared = 0;
  for (const flag of CHAT_V9_FLAGS) {
    if (writeLocalStorage(flag.keys.localStorage, null)) {
      cleared += 1;
    }
  }
  return cleared;
}
