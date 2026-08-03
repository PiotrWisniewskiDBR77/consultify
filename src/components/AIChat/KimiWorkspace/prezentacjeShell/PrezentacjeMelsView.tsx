/**
 * PrezentacjeMelsView — `ExecutiveModuleShell` adapter for the
 * Prezentacje (deck generator) lane.
 *
 * Mounted by `<PrezentacjeView>` when `isMelsPrezentacjeEnabled()`
 * returns true. Wzorem `TabeleMelsView` (EPIC-T16-S3 D2 lane swap,
 * presentational adapter): consumes the same props bag the legacy
 * `<KimiWorkspaceShell lane="prezentacje">` consumes and translates
 * them to:
 *
 *   - `<TopBar>` chips via `buildPrezentacjeTopBarChips`.
 *   - `<LeftRail>` slide navigator via `<PrezentacjeLeftRail>` (NOT an
 *     outline of sections — a thumbnail/number list over
 *     `preview.deckSlides`), plus a bottom CTA to open the full Deck
 *     Builder (the legacy "Preview File" action — an external-editor
 *     navigation, not a rail tool or a chip).
 *   - `<RightRail>` tools via `buildPrezentacjeRightRailTools`
 *     ('activity' only — see `PrezentacjeRightRail` for why
 *     Blocks/Media/Comments are NOT surfaced here).
 *   - Canvas via `<PrezentacjePreviewLayout>` (deck summary + KPIs +
 *     slide list, mirroring the legacy inline render).
 *
 * Constraints:
 *   - Presentational ONLY — does not own pipeline state; forwards
 *     handlers verbatim.
 *   - Right-rail panel CONTENT wiring is deferred (caller may pass
 *     `rightRailPanels={{}}`), same as `TabeleMelsView` /S3.
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ExecutiveModuleShell } from '@/components/shared/ExecutiveModuleShell';

import type { ArtifactPreview } from '../KimiWorkspaceShell';
import { PrezentacjeLeftRail, type PrezentacjeSlide } from './PrezentacjeLeftRail';
import { PrezentacjePreviewLayout } from './PrezentacjePreviewLayout';
import {
  buildPrezentacjeRightRailTools,
  PrezentacjeRightRailPanel,
  type PrezentacjeRightRailPanelRenderers,
  type PrezentacjeRightRailToolId,
} from './PrezentacjeRightRail';
import {
  buildPrezentacjeTopBarChips,
  type Confidentiality,
  type GovernanceVerdict,
  type PrezentacjeTopBarChipsHandlers,
} from './PrezentacjeTopBarChips';

export interface PrezentacjeMelsViewProps {
  /** The deck preview returned from `useKimiArtifactPipeline`. */
  preview: (ArtifactPreview & { type: 'deck' }) | null;
  fallbackTitle?: string;
  moduleLabel?: string;

  confidentiality?: Confidentiality;
  governanceVerdict?: GovernanceVerdict;
  agentOpen?: boolean;
  /** Loading / failed / generating banner content. */
  emptyState?: React.ReactNode;

  onBack?: () => void;
  onTitleChange?: (next: string) => void;
  topBarHandlers?: PrezentacjeTopBarChipsHandlers;

  /** "Preview File" in the legacy shell — opens the full Deck Builder. */
  onOpenBuilder?: () => void;

  rightRailPanels?: PrezentacjeRightRailPanelRenderers;

  onRunPrimary?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutHelp?: () => void;

  persistRailState?: boolean;
}

export const PrezentacjeMelsView: React.FC<PrezentacjeMelsViewProps> = ({
  preview,
  fallbackTitle,
  moduleLabel,
  confidentiality = 'internal',
  governanceVerdict = null,
  agentOpen = false,
  emptyState,
  onBack,
  onTitleChange,
  topBarHandlers = {},
  onOpenBuilder,
  rightRailPanels = {},
  onRunPrimary,
  onOpenCommandPalette,
  onOpenShortcutHelp,
  persistRailState = true,
}) => {
  const { t } = useTranslation();
  const slides: PrezentacjeSlide[] = preview?.deckSlides ?? [];
  const [activeSlideId, setActiveSlideId] = useState<string | null>(slides[0]?.slideId ?? null);
  const effectiveActiveSlideId = slides.some((s) => s.slideId === activeSlideId)
    ? activeSlideId
    : (slides[0]?.slideId ?? null);

  const moduleLbl = moduleLabel ?? t('prezentacje.moduleLabel', 'Prezentacje');
  const title = preview?.title ?? fallbackTitle ?? t('prezentacje.defaultTitle', 'Presentation');

  const chips = useMemo(
    () =>
      buildPrezentacjeTopBarChips({
        handlers: {
          ...topBarHandlers,
          onRun: topBarHandlers.onRun ?? onRunPrimary,
        },
        state: {
          confidentiality,
          governanceVerdict,
          agentOpen,
          runEnabled: Boolean(preview),
        },
        labels: {
          theme: t('prezentacje.topBar.theme', 'Theme'),
          history: t('prezentacje.topBar.history', 'History'),
          qa: t('prezentacje.topBar.qa', 'QA'),
          governance: t('prezentacje.topBar.governance', 'Governance'),
          analytics: t('prezentacje.topBar.analytics', 'Analytics'),
          audit: t('prezentacje.topBar.audit', 'Audit'),
          exportPdf: t('prezentacje.topBar.exportPdf', 'PDF'),
          share: t('prezentacje.topBar.share', 'All files'),
          agent: t('prezentacje.topBar.agent', 'Teresa'),
          run: t('prezentacje.topBar.run', 'Export PPTX'),
        },
      }),
    [topBarHandlers, onRunPrimary, confidentiality, governanceVerdict, agentOpen, preview, t]
  );

  const rightTools = useMemo(
    () =>
      buildPrezentacjeRightRailTools({
        labels: {
          activity: t('prezentacje.rightRail.activity', 'Activity'),
        },
      }),
    [t]
  );

  const leftRailBottomSlot = onOpenBuilder ? (
    <div className="px-3 py-2 border-t border-c-border-subtle">
      <button
        type="button"
        onClick={onOpenBuilder}
        data-testid="prezentacje-mels-open-builder"
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-hig-sm text-xs font-medium bg-c-surface-raised text-c-text hover:bg-c-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        {t('prezentacje.leftRail.openBuilder', 'Otwórz w Builderze')}
      </button>
    </div>
  ) : undefined;

  const canvas = preview ? (
    <div className="px-6 py-4 max-w-[1024px] mx-auto" data-testid="prezentacje-mels-canvas">
      <PrezentacjePreviewLayout preview={preview} onOpenBuilder={onOpenBuilder} />
    </div>
  ) : (
    <div className="px-6 py-12 max-w-[1024px] mx-auto" data-testid="prezentacje-mels-canvas-empty">
      {emptyState ?? (
        <p className="text-sm text-c-text-secondary">
          {t('prezentacje.emptyState', 'No artifact loaded yet.')}
        </p>
      )}
    </div>
  );

  return (
    <ExecutiveModuleShell
      moduleKey="prezentacje"
      moduleLabel={moduleLbl}
      title={title}
      onTitleChange={onTitleChange}
      onBack={onBack}
      backLabel={t('prezentacje.back', 'Back to Prezentacje home')}
      topBarChips={chips}
      leftRailTitle={t('prezentacje.leftRail.title', 'Slides')}
      leftRailBottomSlot={leftRailBottomSlot}
      leftRailContent={
        <PrezentacjeLeftRail
          slides={slides}
          activeSlideId={effectiveActiveSlideId}
          onSelect={(id) => setActiveSlideId(id)}
          emptyLabel={t('prezentacje.leftRail.empty', 'No slides to display.')}
        />
      }
      rightRailTools={rightTools}
      renderRightRailPanel={(activeToolId) => (
        <PrezentacjeRightRailPanel
          activeToolId={activeToolId as PrezentacjeRightRailToolId | null}
          panels={rightRailPanels}
        />
      )}
      canvas={canvas}
      onRunPrimary={onRunPrimary}
      onToggleAgent={topBarHandlers.onToggleAgent}
      onOpenCommandPalette={onOpenCommandPalette}
      onOpenShortcutHelp={onOpenShortcutHelp}
      persistRailState={persistRailState}
      testId="prezentacje-mels-view"
    />
  );
};

export default PrezentacjeMelsView;
