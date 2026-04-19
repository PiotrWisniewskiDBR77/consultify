/**
 * Chat V9 / NAV-M2-lite — pure builder for the workspace breadcrumb
 * pill.
 *
 * What this produces
 * ------------------
 * A minimal `{ segments }` structure the `WorkspaceBreadcrumb`
 * component renders as `Chat › <current view>` above non-chat
 * workspace views. Returns `null` when the breadcrumb should be
 * hidden entirely (the chat shell itself, the pre-auth gate, and
 * full-screen wizard flows where a floating pill would clash).
 *
 * Shape
 * -----
 *   - `segments[0]` is always `{ label: 'Chat', role: 'chat-link' }`
 *     so the component always has a consistent clickable anchor
 *     back to the active conversation.
 *   - `segments[last]` is `{ label: <current view label>, role:
 *     'current' }`, computed from a small curated map with a
 *     humaniser fallback. The fallback is deterministic: enum
 *     token → Title-Cased words, underscores collapsed, common
 *     prefixes like `DISCOVERY_TOOLS_` preserved as the first
 *     segment via a `·` separator (`Discovery Tools · Strategic`).
 *
 * Pure, no DOM, no React, no store. All store access happens in
 * the component; this helper takes raw inputs so the 30+ branches
 * can be unit-tested without rendering anything.
 *
 * Hidden-view rules
 * -----------------
 * Hidden on:
 *   - `AI_CHAT` (the shell itself — breadcrumb would point back to
 *     the view you are already on).
 *   - `WELCOME` / `AUTH` / marketing views where no "chat" context
 *     exists yet.
 *   - When `hasActiveConversation` is false. The "Chat" segment is
 *     only meaningful if the user has a conversation to return to;
 *     otherwise clicking it would drop them on an empty chat.
 *
 * Deliberate non-goals (see plan doc for the full out-of-scope):
 *   - No multi-level hierarchy beyond `Chat › <label>` in v1. A
 *     sub-section segment (e.g. `Chat › Assessment › SIRI`) is a
 *     follow-up ticket once we have real usage signals.
 *   - No internationalisation — labels are English only, matching
 *     the rest of the Chat V9 admin / trust surfaces.
 *   - No icons — keeps the pill visually calm next to the
 *     `BackToChatButton` pill that already sits top-right.
 */

import { AppView } from '../types';

export type WorkspaceBreadcrumbSegmentRole = 'chat-link' | 'view' | 'current';

export interface WorkspaceBreadcrumbSegment {
  label: string;
  role: WorkspaceBreadcrumbSegmentRole;
  /**
   * Optional full-text tooltip for a truncated label. The 3-segment
   * shape truncates the conversation title to keep the pill from
   * stretching across the viewport; callers put the untruncated
   * title in `title` so hover still shows the whole thing.
   */
  title?: string;
}

export interface WorkspaceBreadcrumb {
  segments: readonly WorkspaceBreadcrumbSegment[];
}

/**
 * Hard cap for the conversation-title segment. Matches the
 * existing `max-w-[32ch]` CSS cap on each rendered `<li>` in
 * `WorkspaceBreadcrumb.tsx`; keeping them in sync here means the
 * truncation is visible in the ellipsis even on browsers that
 * handle CSS truncation differently.
 */
export const WORKSPACE_BREADCRUMB_TITLE_MAX = 32;

// Views where the pill must not render. Keep this set tight — it
// mirrors `BackToChatButton.HIDDEN_VIEWS` plus the unauthenticated
// gate (`AUTH`). Onboarding wizards are intentionally NOT hidden;
// they benefit from a "Back to chat" exit the most.
const HIDDEN_VIEWS: ReadonlySet<AppView> = new Set([
  AppView.AI_CHAT,
  AppView.WELCOME,
  AppView.AUTH,
]);

// Curated map of the ~25 workspace views users actually land on.
// Unlisted views fall through to the humaniser. We intentionally
// keep the curated list small; every entry we add is a forever-
// label we have to maintain as the enum evolves.
const CURATED_LABELS: Partial<Record<AppView, string>> = {
  [AppView.APP_INTRO]: 'App intro',
  [AppView.INTERVIEW]: 'AI interview',
  [AppView.DISCOVERY_CONSULTANT]: 'AI interview',
  [AppView.DISCOVERY_TOOLS]: 'Discovery Tools',
  [AppView.DISCOVERY_TOOLS_STRATEGIC]: 'Discovery Tools · Strategic',
  [AppView.DISCOVERY_TOOLS_OPERATIONAL]: 'Discovery Tools · Operational',
  [AppView.DISCOVERY_TOOLS_DIGITAL]: 'Discovery Tools · Digital',
  [AppView.DISCOVERY_TOOLS_PROCESS_AUTOMATION]: 'Discovery Tools · Process automation',
  [AppView.DASHBOARD]: 'Dashboard',
  [AppView.USER_DASHBOARD]: 'Dashboard',
  [AppView.DASHBOARD_OVERVIEW]: 'Dashboard · Overview',
  [AppView.DASHBOARD_SNAPSHOT]: 'Dashboard · Snapshot',
  [AppView.ASSESSMENT_OVERVIEW]: 'Assessment · Overview',
  [AppView.ASSESSMENT_DRD]: 'Assessment · DRD',
  [AppView.ASSESSMENT_SIRI]: 'Assessment · SIRI',
  [AppView.ASSESSMENT_ADMA]: 'Assessment · ADMA',
  [AppView.ASSESSMENT_CMMI]: 'Assessment · CMMI',
  [AppView.ASSESSMENT_LEAN]: 'Assessment · Lean 4.0',
  [AppView.ASSESSMENT_SUMMARY]: 'Assessment · Hub',
  [AppView.MY_ASSESSMENTS]: 'My assessments',
  [AppView.GAP_MAP]: 'Gap map',
  [AppView.WORDY]: 'Wordy',
  [AppView.EXCELE]: 'Excele',
  [AppView.PREZENTACJE_GEN]: 'Prezentacje',
  [AppView.MEETING]: 'Meeting',
  [AppView.PRESENTATIONS]: 'Presentations',
  [AppView.REPORTS_ENTRY]: 'Reports',
  [AppView.REPORTS_MANAGEMENT]: 'Reports · Management',
  [AppView.DRD_AUDIT_REPORT]: 'Reports · DRD audit',
  [AppView.KPI_OKR_DASHBOARD]: 'KPI & OKR',
  [AppView.MASTERCLASS]: 'Masterclass',
  [AppView.RESOURCES]: 'Resources',
};

/**
 * Title-case + separator fallback for enum tokens that have no
 * curated label. Kept deterministic so the test suite can pin the
 * exact formatter output:
 *
 *   `PARTNER_COMMISSION`       -> `Partner commission`
 *   `FULL_STEP1_ASSESSMENT`    -> `Full step1 · Assessment`
 *   `ASSESSMENT_DIGITAL_EXTERNAL` -> `Assessment · Digital external`
 *
 * Strategy: if the token contains 3+ underscore-separated chunks,
 * split on the first underscore to keep `<Category> · <Rest>`. With
 * 2 or fewer chunks, render as one title-cased phrase so we don't
 * produce empty second segments.
 */
function humaniseAppView(view: string): string {
  const raw = String(view ?? '').trim();
  if (raw.length === 0) return 'View';
  const parts = raw.split('_').filter((chunk) => chunk.length > 0);
  if (parts.length === 0) return 'View';
  const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  if (parts.length === 1) {
    return titleCase(parts[0]);
  }
  if (parts.length === 2) {
    // Sentence case — reads like a human phrase rather than a
    // Marketing Title. Matches the curated labels ("My assessments",
    // "Gap map", etc.) so curated and humanised outputs look the
    // same to the user.
    return `${titleCase(parts[0])} ${parts[1].toLowerCase()}`;
  }
  const head = titleCase(parts[0]);
  const tail = parts
    .slice(1)
    .map((p, idx) => (idx === 0 ? titleCase(p) : p.toLowerCase()))
    .join(' ');
  return `${head} · ${tail}`;
}

export interface BuildWorkspaceBreadcrumbInput {
  view: AppView | null | undefined;
  hasActiveConversation: boolean;
  /**
   * Title of the currently active conversation, if any. When
   * `conversationSegmentEnabled` is `true` and this string has
   * meaningful non-whitespace content, the builder appends a third
   * segment with the (possibly truncated) title and demotes the
   * view segment from `current` to `view`. When falsy / blank, the
   * builder falls back to the 2-segment shape.
   */
  conversationTitle?: string | null;
  /**
   * Kill-switch-resolved at the component layer (so the helper
   * stays pure). When `false`, the title is ignored even if
   * provided — behaviour collapses to the NAV-M2-lite
   * 2-segment shape.
   */
  conversationSegmentEnabled?: boolean;
}

function cleanTitle(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

function truncateTitle(title: string): string {
  if (title.length <= WORKSPACE_BREADCRUMB_TITLE_MAX) return title;
  // Ellipsis as a separate character so downstream test assertions
  // can search for the truncation marker without matching the word
  // "…" inside a legitimate title.
  const head = title.slice(0, WORKSPACE_BREADCRUMB_TITLE_MAX - 1).trimEnd();
  return `${head}\u2026`;
}

/**
 * Compute the breadcrumb structure for the given workspace state.
 * Returns `null` when the pill should not render at all (hidden
 * view, no active conversation, or degraded input).
 */
export function buildWorkspaceBreadcrumb(
  input: BuildWorkspaceBreadcrumbInput
): WorkspaceBreadcrumb | null {
  const {
    view,
    hasActiveConversation,
    conversationTitle,
    conversationSegmentEnabled,
  } = input;
  if (!view) return null;
  if (HIDDEN_VIEWS.has(view)) return null;
  if (!hasActiveConversation) return null;

  const curated = CURATED_LABELS[view];
  const label = curated ?? humaniseAppView(view);
  if (label.trim().length === 0) return null;

  const title = conversationSegmentEnabled ? cleanTitle(conversationTitle) : null;
  if (title === null) {
    return {
      segments: [
        { label: 'Chat', role: 'chat-link' },
        { label, role: 'current' },
      ],
    };
  }

  const truncated = truncateTitle(title);
  const chatSegment: WorkspaceBreadcrumbSegment = { label: 'Chat', role: 'chat-link' };
  const viewSegment: WorkspaceBreadcrumbSegment = { label, role: 'view' };
  const titleSegment: WorkspaceBreadcrumbSegment = {
    label: truncated,
    role: 'current',
  };
  // Only attach the full-text tooltip when truncation actually
  // happened; avoids redundant `title="same as label"` on short
  // titles and keeps the DOM lean.
  if (truncated !== title) {
    titleSegment.title = title;
  }

  return {
    segments: [chatSegment, viewSegment, titleSegment],
  };
}

/**
 * Exposed for test parity — callers should normally use
 * `buildWorkspaceBreadcrumb` which encapsulates the null-return
 * policy. The fallback formatter is pure and deterministic so
 * tests can pin both curated and humanised cases.
 */
export { humaniseAppView as _humaniseAppViewForTest };
