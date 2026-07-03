/**
 * TabeleTopBarChips — descriptor builder for the Tabele top bar.
 *
 * EPIC-T16 D4. Returns a `TopBarChipDescriptor[]` array honouring the
 * MELS canonical chip order (Internal → Theme → History → QA →
 * Governance → Analytics → Audit → Share → Agent → Run).
 *
 * The component is a builder, not a renderer — `<TopBar>` from the
 * shell does the actual rendering. This keeps the shell module-agnostic
 * and lets us unit-test the chip list without DOM rendering.
 *
 * The TopBar primary chip ("Run") is for the Tabele lane "Run" action
 * (re-run pipeline, present, etc — caller decides). Caller-supplied
 * handlers may be undefined for chips the lane doesn't surface yet;
 * those chips are rendered as disabled.
 */

import {
  Activity,
  Bot,
  Eye,
  FileSearch,
  History,
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

export type Confidentiality = 'public' | 'internal' | 'confidential';
export type GovernanceVerdict =
  | 'PASS'
  | 'PASS_WITH_P2'
  | 'BLOCKED_P1'
  | 'BLOCKED_P0'
  | 'INCONCLUSIVE'
  | null;

export interface TabeleTopBarChipsLabels {
  internal?: string;
  internalLabels?: Record<Confidentiality, string>;
  theme?: string;
  history?: string;
  qa?: string;
  governance?: string;
  analytics?: string;
  audit?: string;
  share?: string;
  agent?: string;
  run?: string;
}

export interface TabeleTopBarChipsHandlers {
  onConfidentiality?: () => void;
  onTheme?: () => void;
  onHistory?: () => void;
  onQa?: () => void;
  onGovernance?: () => void;
  onAnalytics?: () => void;
  onAudit?: () => void;
  onShare?: () => void;
  onToggleAgent?: () => void;
  onRun?: () => void;
}

export interface TabeleTopBarChipsState {
  confidentiality?: Confidentiality;
  governanceVerdict?: GovernanceVerdict;
  agentOpen?: boolean;
  /** When false the chip is rendered but disabled. */
  runEnabled?: boolean;
  /** Verdict dot under the QA chip ("•" coloured by tone). */
  qaDotTone?: TopBarChipDotTone;
  /** Auto-disables analytics until artifact is materialised. */
  analyticsEnabled?: boolean;
}

const DEFAULT_LABELS: Required<Omit<TabeleTopBarChipsLabels, 'internalLabels'>> & {
  internalLabels: Record<Confidentiality, string>;
} = {
  internal: 'Internal',
  internalLabels: {
    public: 'Public',
    internal: 'Internal',
    confidential: 'Confidential',
  },
  theme: 'Theme',
  history: 'History',
  qa: 'QA',
  governance: 'Governance',
  analytics: 'Analytics',
  audit: 'Audit',
  share: 'Share',
  agent: 'Agent',
  run: 'Run',
};

const VERDICT_TONE: Record<NonNullable<GovernanceVerdict>, TopBarChipDotTone> = {
  PASS: 'success',
  PASS_WITH_P2: 'warning',
  BLOCKED_P1: 'warning',
  BLOCKED_P0: 'danger',
  INCONCLUSIVE: 'neutral',
};

const CONFIDENTIALITY_TONE: Record<Confidentiality, TopBarChipDotTone> = {
  public: 'success',
  internal: 'info',
  confidential: 'danger',
};

/**
 * Build the Tabele lane chip descriptor list.
 *
 * Chips are ALWAYS returned in MELS canonical order (the shell will
 * also enforce ordering, but returning sorted lets us unit-test the
 * exact ordering deterministically).
 */
export function buildTabeleTopBarChips(args: {
  handlers: TabeleTopBarChipsHandlers;
  state?: TabeleTopBarChipsState;
  labels?: TabeleTopBarChipsLabels;
}): TopBarChipDescriptor[] {
  const { handlers, state = {}, labels = {} } = args;
  const L = {
    ...DEFAULT_LABELS,
    ...labels,
    internalLabels: { ...DEFAULT_LABELS.internalLabels, ...labels.internalLabels },
  };

  const confidentiality = state.confidentiality ?? 'internal';
  const verdict = state.governanceVerdict ?? null;

  // Command-row hierarchy (editor-shell-canon § 2 STREFA GÓRNA): the 10
  // MELS chips are tiered instead of rendered flat. Primary = Run (the
  // lane action). Secondary = frequent state chips (Confidentiality,
  // Theme, QA, Share, Agent). Overflow (`⋯`) = rare/advisory chips
  // (History, Governance, Analytics, Audit).
  const chips: TopBarChipDescriptor[] = [
    {
      id: 'internal',
      label: L.internalLabels[confidentiality] || L.internal,
      icon: Shield,
      onClick: handlers.onConfidentiality,
      disabled: !handlers.onConfidentiality,
      dotTone: CONFIDENTIALITY_TONE[confidentiality],
      tooltip: `Confidentiality: ${L.internalLabels[confidentiality]}`,
      group: 'secondary',
    },
    {
      id: 'theme',
      label: L.theme,
      icon: Palette,
      onClick: handlers.onTheme,
      disabled: !handlers.onTheme,
      group: 'secondary',
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
      group: 'secondary',
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
      id: 'share',
      label: L.share,
      icon: Share2,
      onClick: handlers.onShare,
      disabled: !handlers.onShare,
      group: 'secondary',
    },
    {
      id: 'agent',
      label: L.agent,
      icon: Bot,
      onClick: handlers.onToggleAgent,
      disabled: !handlers.onToggleAgent,
      kind: 'toggle',
      active: Boolean(state.agentOpen),
      group: 'secondary',
    },
    {
      id: 'run',
      label: L.run,
      icon: state.agentOpen ? Eye : Play,
      onClick: handlers.onRun,
      disabled: !handlers.onRun || state.runEnabled === false,
      kind: 'primary',
      group: 'primary',
    },
  ];

  return chips;
}
