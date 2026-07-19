/**
 * DeckBuilderMelsChips — descriptor builder for the DeckBuilder top bar
 * under the MELS shell (EE / Deliverables unification WS-A4).
 *
 * Returns a `TopBarChipDescriptor[]` honouring the MELS canonical chip
 * order (Internal → Theme → History → QA → Governance → Analytics →
 * Audit → Share → Agent → Run). Mirrors `TabeleTopBarChips` so the three
 * editors (Wordy / Tabele / Prezentacje) expose an identical top bar.
 *
 * This is a builder, not a renderer — the shell's `<TopBar>` renders the
 * chips. Caller-supplied handlers may be undefined for actions the deck
 * doesn't surface yet; those chips render as disabled.
 *
 * Owner note #84/Z124 (2026-07-12): bar was overloaded — Theme/History/QA/
 * Governance/Analytics/Audit all rendered flat, equal-weight secondary
 * chips (no explicit `group` fell back to `secondary` for all of them).
 * Fix: History/QA/Governance/Analytics/Audit now carry `group: 'overflow'`,
 * so `<TopBar>`'s existing tier mechanism (`resolveChipGroup` — primary ·
 * secondary · overflow, editor-shell-canon § 2 STREFA GÓRNA) folds them
 * behind the single `⋯` menu it already renders (adopted from
 * `NotebookHamburgerMenu` — see `ChipDescriptor.ts` / `TopBar.tsx`
 * `OverflowMenu`). Zero functions removed — same handlers, same chips,
 * just re-tiered. Core bar stays: Internal (confidentiality) · Theme ·
 * Share · Comments · Agent (Teresa) · Run (Present) — "Save/status" lives
 * in the shell's separate `presenceSlot` prop, untouched here.
 */

import {
  Activity,
  Bot,
  Eye,
  FileSearch,
  History,
  MessageSquare,
  MonitorPlay,
  Palette,
  Play,
  Share2,
  Shield,
  ShieldCheck,
} from 'lucide-react';

import {
  type TopBarChipDescriptor,
  type TopBarChipDotTone,
} from '@/components/shared/ExecutiveModuleShell/ChipDescriptor';

export type DeckConfidentiality = 'public' | 'internal' | 'confidential';
export type DeckGovernanceVerdict =
  | 'PASS'
  | 'PASS_WITH_P2'
  | 'BLOCKED_P1'
  | 'BLOCKED_P0'
  | 'INCONCLUSIVE'
  | null;

export interface DeckBuilderTopBarChipsLabels {
  internal?: string;
  internalLabels?: Record<DeckConfidentiality, string>;
  theme?: string;
  history?: string;
  qa?: string;
  governance?: string;
  analytics?: string;
  audit?: string;
  comments?: string;
  share?: string;
  agent?: string;
  run?: string;
  presenter?: string;
}

export interface DeckBuilderTopBarChipsHandlers {
  onConfidentiality?: () => void;
  onTheme?: () => void;
  onHistory?: () => void;
  onQa?: () => void;
  onGovernance?: () => void;
  onAnalytics?: () => void;
  onAudit?: () => void;
  /** Toggle the Comments right-rail panel. */
  onToggleComments?: () => void;
  onShare?: () => void;
  onToggleAgent?: () => void;
  /** Primary chip — "Present" (audience fullscreen) for the deck lane. */
  onRun?: () => void;
  /**
   * J12-S2 — presenter view (speaker notes + next slide + timer). Distinct
   * from the primary "Present" chip; folds into the overflow (⋯) menu.
   */
  onPresenter?: () => void;
}

export interface DeckBuilderTopBarChipsState {
  confidentiality?: DeckConfidentiality;
  governanceVerdict?: DeckGovernanceVerdict;
  /** Whether the Teresa agent panel is open (drives the agent toggle). */
  agentOpen?: boolean;
  /** When false the Present chip is rendered but disabled (e.g. empty deck). */
  runEnabled?: boolean;
  /** Verdict dot under the QA chip. */
  qaDotTone?: TopBarChipDotTone;
  /** Auto-disables analytics until the deck has a shareable link. */
  analyticsEnabled?: boolean;
  /** Whether the Comments right-rail panel is currently active. */
  commentsOpen?: boolean;
  /** Open comment threads — drives the info dot on the Comments chip. */
  openCommentCount?: number;
}

const DEFAULT_LABELS: Required<Omit<DeckBuilderTopBarChipsLabels, 'internalLabels'>> & {
  internalLabels: Record<DeckConfidentiality, string>;
} = {
  internal: 'Internal',
  internalLabels: {
    public: 'Public',
    internal: 'Internal',
    confidential: 'Confidential',
  },
  theme: 'Theme',
  history: 'History',
  qa: 'Quality',
  governance: 'Governance',
  analytics: 'Analytics',
  audit: 'Audit',
  comments: 'Comments',
  share: 'Share',
  agent: 'Teresa',
  run: 'Present',
  presenter: 'Presenter view',
};

const VERDICT_TONE: Record<NonNullable<DeckGovernanceVerdict>, TopBarChipDotTone> = {
  PASS: 'success',
  PASS_WITH_P2: 'warning',
  BLOCKED_P1: 'warning',
  BLOCKED_P0: 'danger',
  INCONCLUSIVE: 'neutral',
};

const CONFIDENTIALITY_TONE: Record<DeckConfidentiality, TopBarChipDotTone> = {
  public: 'success',
  internal: 'info',
  confidential: 'danger',
};

/**
 * Build the DeckBuilder chip descriptor list in MELS canonical order.
 */
export function buildDeckBuilderTopBarChips(args: {
  handlers: DeckBuilderTopBarChipsHandlers;
  state?: DeckBuilderTopBarChipsState;
  labels?: DeckBuilderTopBarChipsLabels;
}): TopBarChipDescriptor[] {
  const { handlers, state = {}, labels = {} } = args;
  const L = {
    ...DEFAULT_LABELS,
    ...labels,
    internalLabels: { ...DEFAULT_LABELS.internalLabels, ...labels.internalLabels },
  };

  const confidentiality = state.confidentiality ?? 'internal';
  const verdict = state.governanceVerdict ?? null;

  const chips: TopBarChipDescriptor[] = [
    {
      id: 'internal',
      label: L.internalLabels[confidentiality] || L.internal,
      icon: Shield,
      onClick: handlers.onConfidentiality,
      disabled: !handlers.onConfidentiality,
      dotTone: CONFIDENTIALITY_TONE[confidentiality],
      tooltip: `Confidentiality: ${L.internalLabels[confidentiality]}`,
    },
    {
      id: 'theme',
      label: L.theme,
      icon: Palette,
      onClick: handlers.onTheme,
      disabled: !handlers.onTheme,
    },
    {
      id: 'history',
      label: L.history,
      icon: History,
      onClick: handlers.onHistory,
      disabled: !handlers.onHistory,
      group: 'overflow',
    },
    {
      id: 'qa',
      label: L.qa,
      icon: ShieldCheck,
      onClick: handlers.onQa,
      disabled: !handlers.onQa,
      dotTone: state.qaDotTone ?? null,
      group: 'overflow',
    },
    {
      id: 'governance',
      label: L.governance,
      icon: ShieldCheck,
      onClick: handlers.onGovernance,
      disabled: !handlers.onGovernance,
      dotTone: verdict ? VERDICT_TONE[verdict] : null,
      group: 'overflow',
    },
    {
      id: 'analytics',
      label: L.analytics,
      icon: Activity,
      onClick: handlers.onAnalytics,
      disabled: !handlers.onAnalytics || state.analyticsEnabled === false,
      group: 'overflow',
    },
    {
      id: 'audit',
      label: L.audit,
      icon: FileSearch,
      onClick: handlers.onAudit,
      disabled: !handlers.onAudit,
      group: 'overflow',
    },
    {
      // J12-S2 — presenter view. Kept out of the primary "Present" chip (which
      // runs the audience fullscreen) and folded into the overflow (⋯) menu.
      id: 'presenter',
      label: L.presenter,
      icon: MonitorPlay,
      onClick: handlers.onPresenter,
      disabled: !handlers.onPresenter || state.runEnabled === false,
      group: 'overflow',
    },
    {
      id: 'share',
      label: L.share,
      icon: Share2,
      onClick: handlers.onShare,
      disabled: !handlers.onShare,
    },
    {
      id: 'comments',
      label: L.comments,
      icon: MessageSquare,
      onClick: handlers.onToggleComments,
      disabled: !handlers.onToggleComments,
      kind: 'toggle',
      active: Boolean(state.commentsOpen),
      dotTone:
        typeof state.openCommentCount === 'number' && state.openCommentCount > 0 ? 'info' : null,
    },
    {
      id: 'agent',
      label: L.agent,
      icon: Bot,
      onClick: handlers.onToggleAgent,
      disabled: !handlers.onToggleAgent,
      kind: 'toggle',
      active: Boolean(state.agentOpen),
    },
    {
      id: 'run',
      label: L.run,
      icon: state.agentOpen ? Eye : Play,
      onClick: handlers.onRun,
      disabled: !handlers.onRun || state.runEnabled === false,
      kind: 'primary',
    },
  ];

  return chips;
}
