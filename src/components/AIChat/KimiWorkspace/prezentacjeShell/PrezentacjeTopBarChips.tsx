/**
 * PrezentacjeTopBarChips — descriptor builder for the Prezentacje
 * (deck generator) lane top bar under the MELS shell.
 *
 * Returns a `TopBarChipDescriptor[]` honouring the MELS canonical chip
 * order (Internal → Theme → History → QA → Governance → Analytics →
 * Audit → Share → Agent → Run), mirroring `TabeleTopBarChips` /
 * `DeckBuilderMelsChips` so the three editors share identical chrome.
 *
 * This lane is the CHAT GENERATOR screen (`PrezentacjeView`), not the
 * full `DeckBuilder` — it does not own confidentiality / theme /
 * version-history / QA / governance / analytics / audit / Teresa-toggle
 * state, so those chips are ALWAYS rendered (chrome parity) but stay
 * disabled unless a caller ever wires a handler. Only the actions that
 * genuinely exist on this screen are wired by the caller:
 *   - `onRun` (primary)  → export PPTX (`PrezentacjeView.handleDownload`)
 *   - `onExportPdf`      → export PDF (`PrezentacjeView.handleDownloadPdf`)
 *     — non-canonical extra chip (same precedent as DeckBuilder's
 *     `comments` chip), placed between Audit and Share.
 *   - `onShare`          → "All files" library navigation
 *     (`PrezentacjeView.handleAllFiles`) — reuses the Share slot,
 *     same precedent `TabeleView` already established for `onShare`.
 *
 * `Otwórz w Builderze` (`handlePreviewFile`) is NOT a chip — it opens
 * an external editor route, not a panel, so it is surfaced as a
 * left-rail CTA in `PrezentacjeMelsView` instead (see that file).
 */

import {
  Activity,
  Bot,
  Download,
  FileText,
  History,
  Palette,
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

export interface PrezentacjeTopBarChipsLabels {
  internal?: string;
  internalLabels?: Record<Confidentiality, string>;
  theme?: string;
  history?: string;
  qa?: string;
  governance?: string;
  analytics?: string;
  audit?: string;
  exportPdf?: string;
  share?: string;
  agent?: string;
  run?: string;
}

export interface PrezentacjeTopBarChipsHandlers {
  onConfidentiality?: () => void;
  onTheme?: () => void;
  onHistory?: () => void;
  onQa?: () => void;
  onGovernance?: () => void;
  onAnalytics?: () => void;
  onAudit?: () => void;
  /** Export PDF — real, existing action (`handleDownloadPdf`). */
  onExportPdf?: () => void;
  /** Reused as "All files" library navigation (`handleAllFiles`). */
  onShare?: () => void;
  onToggleAgent?: () => void;
  /** Primary chip — export PPTX (`handleDownload`). */
  onRun?: () => void;
}

export interface PrezentacjeTopBarChipsState {
  confidentiality?: Confidentiality;
  governanceVerdict?: GovernanceVerdict;
  agentOpen?: boolean;
  /** When false the Run chip is rendered but disabled (no deck yet). */
  runEnabled?: boolean;
  qaDotTone?: TopBarChipDotTone;
  analyticsEnabled?: boolean;
}

const DEFAULT_LABELS: Required<Omit<PrezentacjeTopBarChipsLabels, 'internalLabels'>> & {
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
  exportPdf: 'PDF',
  share: 'All files',
  agent: 'Teresa',
  run: 'Export PPTX',
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
 * Build the Prezentacje lane chip descriptor list, MELS canonical order
 * plus the `exportPdf` extra (between Audit and Share).
 */
export function buildPrezentacjeTopBarChips(args: {
  handlers: PrezentacjeTopBarChipsHandlers;
  state?: PrezentacjeTopBarChipsState;
  labels?: PrezentacjeTopBarChipsLabels;
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
    },
    {
      id: 'qa',
      label: L.qa,
      icon: ShieldCheck,
      onClick: handlers.onQa,
      disabled: !handlers.onQa,
      dotTone: state.qaDotTone ?? null,
    },
    {
      id: 'governance',
      label: L.governance,
      icon: ShieldCheck,
      onClick: handlers.onGovernance,
      disabled: !handlers.onGovernance,
      dotTone: verdict ? VERDICT_TONE[verdict] : null,
    },
    {
      id: 'analytics',
      label: L.analytics,
      icon: Activity,
      onClick: handlers.onAnalytics,
      disabled: !handlers.onAnalytics || state.analyticsEnabled === false,
    },
    {
      id: 'audit',
      label: L.audit,
      icon: FileText,
      onClick: handlers.onAudit,
      disabled: !handlers.onAudit,
    },
    {
      id: 'exportPdf',
      label: L.exportPdf,
      icon: FileText,
      onClick: handlers.onExportPdf,
      disabled: !handlers.onExportPdf,
    },
    {
      id: 'share',
      label: L.share,
      icon: Share2,
      onClick: handlers.onShare,
      disabled: !handlers.onShare,
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
      icon: Download,
      onClick: handlers.onRun,
      disabled: !handlers.onRun || state.runEnabled === false,
      kind: 'primary',
    },
  ];

  return chips;
}
