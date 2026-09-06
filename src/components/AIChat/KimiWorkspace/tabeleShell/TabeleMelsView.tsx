/**
 * TabeleMelsView — `ExecutiveModuleShell` adapter for the Tabele lane.
 *
 * EPIC-T16-S3 (D2 lane swap, presentational adapter).
 *
 * This component is mounted by `<TabeleView>` when `isMelsTabeleEnabled()`
 * returns true. It consumes the same props bag the legacy
 * `<KimiWorkspaceShell lane="tabele">` consumes, and translates them to:
 *
 *   - `<TopBar>` chips via `buildTabeleTopBarChips`.
 *   - `<LeftRail>` outline via `<TabeleLeftRail>` (Foundation Block
 *     sections, with badges derived from the preview).
 *   - `<RightRail>` tools via `buildTabeleRightRailTools`.
 *   - Canvas via `<TabelePreviewLayout>` (Word-document idiom — KPI /
 *     Schema / Records / Relations / Rationale).
 *
 * Constraints:
 *   - The adapter is presentational ONLY. It does not own pipeline
 *     state; it forwards handlers verbatim.
 *   - When `preview === null`, the canvas renders the `emptyState` slot
 *     (loading / generating / artifact-not-yet-materialised).
 *   - All AI buttons (AI Editor, QA Report) are surfaced ONLY via the
 *     right rail per `.cursor/rules/ai-actions-menu3.mdc`.
 *
 * Out of scope (deferred to S4):
 *   - Wiring of right-rail panels (AI Editor 8 levels, QA Report,
 *     Source Pack) — placeholders supplied by caller for now.
 *   - Width-resize drag handle UX.
 *   - Help-modal listing for shortcut display strings.
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ExecutiveModuleShell } from '@/components/shared/ExecutiveModuleShell';

import type { ArtifactPreview } from '../KimiWorkspaceShell';
import TabelePreviewLayout from '../tabelePreview/TabelePreviewLayout';
import { TabeleLeftRail, type TabeleOutlineItem, type TabeleSectionId } from './TabeleLeftRail';
import {
  buildTabeleRightRailTools,
  TabeleArtifactPanel,
  TabeleRightRailPanel,
  type TabeleArtifactMeta,
  type TabeleRightRailPanelRenderers,
  type TabeleRightRailToolId,
} from './TabeleRightRail';
import {
  buildTabeleTopBarChips,
  type Confidentiality,
  type GovernanceVerdict,
  type TabeleTopBarChipsHandlers,
} from './TabeleTopBarChips';

export interface TabeleMelsViewProps {
  /** The tabele preview returned from `useKimiArtifactPipeline`. */
  preview: (ArtifactPreview & { type: 'tabele' }) | null;
  /** Title shown in the breadcrumb when preview is null. */
  fallbackTitle?: string;
  /** Module label shown left of the title. */
  moduleLabel?: string;

  /** State surfaces. */
  confidentiality?: Confidentiality;
  governanceVerdict?: GovernanceVerdict;
  agentOpen?: boolean;
  qaFindingsCount?: number;
  sourcePackCount?: number;
  /** Loading / failed / generating banner content. */
  emptyState?: React.ReactNode;

  /** Handlers (forwarded verbatim from TabeleView). */
  onBack?: () => void;
  onTitleChange?: (next: string) => void;
  topBarHandlers?: TabeleTopBarChipsHandlers;

  /** Right rail panel slots (caller-supplied content per tool). */
  rightRailPanels?: TabeleRightRailPanelRenderers;

  /** Optional override for the left-rail outline. */
  leftRailItems?: TabeleOutlineItem[];
  initialActiveSection?: TabeleSectionId;
  leftRailToolsSlot?: React.ReactNode;
  leftRailBottomSlot?: React.ReactNode;

  /** Hooks for the keyboard shortcut registry. */
  onRunPrimary?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutHelp?: () => void;

  /** Persistence opt-out for tests. */
  persistRailState?: boolean;

  /**
   * Controlled override for the active right-rail tool. Pominięte (domyślnie
   * wszędzie w produkcji — `TabeleView.tsx` go nie podaje) → `ExecutiveModuleShell`
   * zostaje NIESTEROWANY jak dziś (klik ikony, własny stan wewnętrzny). Jedyny
   * realny konsument: harness dev-render (`prawy-pas-tabele-system.tsx`) —
   * `grafika-zrzuty.mjs` nie klika UI, więc zrzut trybu Artefakt potrzebuje
   * deterministycznego wejścia bez interakcji.
   */
  activeRightRailToolId?: string | null;
}

const DEFAULT_OUTLINE_KEYS: TabeleSectionId[] = [
  'cover',
  'kpi',
  'schema',
  'records',
  'relations',
  'rationale',
];

function deriveOutlineFromPreview(
  preview: TabeleMelsViewProps['preview']
): TabeleOutlineItem[] | undefined {
  if (!preview) return undefined;
  const fields = preview.tabeleSchemaFields ?? [];
  const relations = preview.tabeleRelations ?? [];
  const records = preview.tableData?.rows ?? [];
  const overrides: Record<TabeleSectionId, Partial<TabeleOutlineItem>> = {
    kpi: { badge: preview.kpiItems?.length ?? 0 },
    schema: { badge: fields.length },
    records: { badge: records.length },
    relations: { badge: relations.length },
  };
  // Build using defaults; we only override `badge`.
  return DEFAULT_OUTLINE_KEYS.map((id) => {
    const override = overrides[id];
    return override ? { id, label: id, ...override } : { id, label: id };
  });
}

export const TabeleMelsView: React.FC<TabeleMelsViewProps> = ({
  preview,
  fallbackTitle,
  moduleLabel,
  confidentiality = 'internal',
  governanceVerdict = null,
  agentOpen = false,
  qaFindingsCount,
  sourcePackCount,
  emptyState,
  onBack,
  onTitleChange,
  topBarHandlers = {},
  rightRailPanels = {},
  leftRailItems,
  initialActiveSection = 'cover',
  leftRailToolsSlot,
  leftRailBottomSlot,
  onRunPrimary,
  onOpenCommandPalette,
  onOpenShortcutHelp,
  persistRailState = true,
  activeRightRailToolId,
}) => {
  const { t, i18n } = useTranslation();
  const [activeSection, setActiveSection] = useState<TabeleSectionId>(initialActiveSection);

  const moduleLbl = moduleLabel ?? t('tabele.moduleLabel', 'Tabele');
  const title = preview?.title ?? fallbackTitle ?? t('tabele.defaultTitle', 'Operational table');

  const chips = useMemo(
    () =>
      buildTabeleTopBarChips({
        handlers: {
          ...topBarHandlers,
          onRun: topBarHandlers.onRun ?? onRunPrimary,
        },
        state: {
          confidentiality,
          governanceVerdict,
          agentOpen,
          runEnabled: Boolean(preview),
          analyticsEnabled: Boolean(preview),
        },
        labels: {
          theme: t('tabele.topBar.theme', 'Theme'),
          history: t('tabele.topBar.history', 'History'),
          qa: t('tabele.topBar.qa', 'QA'),
          governance: t('tabele.topBar.governance', 'Governance'),
          analytics: t('tabele.topBar.analytics', 'Analytics'),
          audit: t('tabele.topBar.audit', 'Audit'),
          share: t('tabele.topBar.share', 'Share'),
          agent: t('tabele.topBar.agent', 'Agent'),
          run: t('tabele.topBar.run', 'Run'),
        },
      }),
    [topBarHandlers, onRunPrimary, confidentiality, governanceVerdict, agentOpen, preview, t]
  );

  const leftItems = useMemo(() => {
    if (leftRailItems) return leftRailItems;
    return deriveOutlineFromPreview(preview);
  }, [leftRailItems, preview]);

  const isPolish = !!i18n.language?.startsWith('pl');

  // ★ Tryb Artefakt (docs/program/grafika/ANALIZA_PRAWY_PANEL.md, tor grafiki
  // 2026-08-30) — metadane REALNE z `preview`/`confidentiality`/
  // `governanceVerdict`, nie stub. Za flagą `ff_artifact_right_rail`
  // (sprawdzaną wewnątrz `buildTabeleRightRailTools`/`TabeleArtifactPanel`,
  // nie tutaj — ten widok nie decyduje o fladze, tylko dostarcza treść).
  const artifactMeta = useMemo<TabeleArtifactMeta>(
    () => ({
      title: preview?.title,
      confidentiality,
      governanceVerdict,
      recordCount: preview?.tableData?.rows?.length,
      fieldCount: preview?.tabeleSchemaFields?.length,
      relations: (preview?.tabeleRelations ?? []).map((rel) => ({
        fieldName: rel.fieldName,
        targetTableName: rel.targetTableName,
        targetCount: rel.targetCount,
      })),
      isPolish,
    }),
    [preview, confidentiality, governanceVerdict, isPolish]
  );

  const rightTools = useMemo(
    () =>
      buildTabeleRightRailTools({
        state: {
          qaFindingsCount,
          sourcePackCount,
          aiEditorEnabled: Boolean(preview),
        },
        labels: {
          search: t('tabele.rightRail.search', 'Search records'),
          aiEditor: t('tabele.rightRail.aiEditor', 'AI Editor'),
          qaReport: t('tabele.rightRail.qaReport', 'QA Report'),
          sourcePack: t('tabele.rightRail.sourcePack', 'Source Pack'),
          layout: t('tabele.rightRail.layout', 'Layout'),
          share: t('tabele.rightRail.share', 'Share'),
          analytics: t('tabele.rightRail.analytics', 'Analytics'),
        },
        artifact: artifactMeta,
        artifactLabel: t('tabele.rightRail.artefakt', isPolish ? 'Artefakt' : 'Artifact'),
      }),
    [qaFindingsCount, sourcePackCount, preview, t, artifactMeta, isPolish]
  );

  // Bramkowanie NA TREŚCI panelu, nie tylko na liście ikon szyny (`rightTools`
  // wyżej) — gdyby ktoś ustawił `activeRightRailToolId="artefakt"` z zewnątrz
  // przy fladze OFF (klucz nie istnieje w `tools`, ale `TabeleRightRailPanel`
  // szuka po `activeToolId`, nie po obecności ikony), panel nie ma się mieć
  // co pokazać — OFF musi być identyczne na KAŻDYM poziomie, nie tylko szyny.
  const rightPanels = useMemo<TabeleRightRailPanelRenderers>(
    () => ({ ...rightRailPanels, artefakt: <TabeleArtifactPanel meta={artifactMeta} /> }),
    [rightRailPanels, artifactMeta]
  );

  const canvas = preview ? (
    <div className="px-6 py-4 max-w-[1024px] mx-auto" data-testid="tabele-mels-canvas">
      <TabelePreviewLayout
        preview={preview}
        {...(onRunPrimary ? { onOpenBuilder: onRunPrimary } : {})}
      />
    </div>
  ) : (
    <div className="px-6 py-12 max-w-[1024px] mx-auto" data-testid="tabele-mels-canvas-empty">
      {emptyState ?? (
        <p className="text-sm text-c-text-secondary">
          {t('tabele.emptyState', 'No artifact loaded yet.')}
        </p>
      )}
    </div>
  );

  return (
    <ExecutiveModuleShell
      moduleKey="tabele"
      moduleLabel={moduleLbl}
      title={title}
      onTitleChange={onTitleChange}
      onBack={onBack}
      backLabel={t('tabele.back', 'Back to Tabele home')}
      topBarChips={chips}
      leftRailTitle={t('tabele.leftRail.title', 'Outline')}
      leftRailToolsSlot={leftRailToolsSlot}
      leftRailBottomSlot={leftRailBottomSlot}
      leftRailContent={
        <TabeleLeftRail
          items={leftItems}
          activeItemId={activeSection}
          onSelect={(id) => setActiveSection(id)}
          emptyLabel={t('tabele.leftRail.empty', 'No sections to display.')}
        />
      }
      rightRailTools={rightTools}
      activeRightRailToolId={activeRightRailToolId}
      renderRightRailPanel={(activeToolId) => (
        <TabeleRightRailPanel
          activeToolId={activeToolId as TabeleRightRailToolId | null}
          panels={rightPanels}
        />
      )}
      canvas={canvas}
      onRunPrimary={onRunPrimary}
      onToggleAgent={topBarHandlers.onToggleAgent}
      onOpenCommandPalette={onOpenCommandPalette}
      onOpenShortcutHelp={onOpenShortcutHelp}
      persistRailState={persistRailState}
      testId="tabele-mels-view"
    />
  );
};

export default TabeleMelsView;
