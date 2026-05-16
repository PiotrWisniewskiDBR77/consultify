/**
 * useTabeleRightRailPanels — connector hook that wires `TabeleAiEditorPanel`
 * + `TabeleQaPanel` together for the right rail.
 *
 * Manages the cross-panel handoff: when the user clicks "Open in AI
 * Editor" on a QA suggestion, this hook records a preset that the AI
 * Editor panel reads on next render (level + prompt + context).
 *
 * Behind the kill switches:
 *   - `isTabeleAiEditorEnabled()` (client-side)
 *   - `isTabeleQaEnabled()`       (client-side)
 *
 * The backend feature flags (`ENABLE_TABLE_AI_EDITOR`,
 * `ENABLE_TABLE_QA_ENGINE`) are still authoritative; this hook only
 * controls UI surface so users behind the kill switch never see the
 * panels.
 *
 * Block C · EPIC-T10 + EPIC-T11 · Sprint C-S5.
 */

import React, { useCallback, useMemo, useState } from 'react';

import type { AiEditorLevel, QaSuggestion, SourcePack } from '@/services/api/tablePlatform.api';
import { isTabeleAiEditorEnabled } from '@/utils/tabeleAiEditorFlag';
import { isTabeleConversionsEnabled } from '@/utils/tabeleConversionsFlag';
import { isTabeleQaEnabled } from '@/utils/tabeleQaFlag';
import { isTabeleSourcePackEnabled } from '@/utils/tabeleSourcePackFlag';

import { TabeleAiEditorPanel } from './aiEditor/TabeleAiEditorPanel';
import { TabeleQaPanel } from './qa/TabeleQaPanel';
import { TabeleSharePanel } from './share/TabeleSharePanel';
import { TabeleSourcePackPanel } from './sourcePack/TabeleSourcePackPanel';
import type { TabeleRightRailPanelRenderers } from './TabeleRightRail';

export interface UseTabeleRightRailPanelsArgs {
  tableId: string | null | undefined;
  workspaceId: string | null | undefined;
  isSuperAdmin?: boolean;
  /** Permits unit tests to bypass the kill switches without monkey-patching. */
  forceEnableForTesting?: boolean;
  /**
   * Optional callback invoked when the AI Editor successfully applies a
   * proposal. Lets the parent view re-fetch the table preview so the
   * canvas reflects the just-applied diff (no false-positive
   * "applied but UI stale" gap).
   */
  onAfterApply?: () => void;
}

export interface UseTabeleRightRailPanelsResult {
  rightRailPanels: TabeleRightRailPanelRenderers;
  /** True when at least one panel was wired (kill switches off + tableId/ws known). */
  panelsActive: boolean;
}

interface AiEditorPreset {
  level: AiEditorLevel;
  prompt: string;
  context: Record<string, unknown>;
  /** Bumped each time a preset is applied so the AI Editor's `useEffect`
   *  re-syncs even if the level/prompt didn't change. */
  nonce: number;
}

function presetFromSuggestion(s: QaSuggestion, nonce: number): AiEditorPreset {
  const action = s.recommendedAction;
  const promptByAxis: Record<QaSuggestion['axis'], string> = {
    completeness: `Fill missing values: ${s.description}`,
    freshness: `Verify stale records: ${s.description}`,
    sourceCoverage: `Suggest sources for records lacking them: ${s.description}`,
    methodology: `Review methodology deviations: ${s.description}`,
    formulaConsistency: `Fix formula errors: ${s.description}`,
  };
  return {
    level: action.level,
    prompt: promptByAxis[s.axis],
    context: { ...action.payload, fromQaSuggestionId: s.id },
    nonce,
  };
}

function presetFromPack(pack: SourcePack, nonce: number): AiEditorPreset {
  // Default the AI Editor to column-fill since that's the most common reason
  // a curator hands a pack to AI; the user can switch level inside the panel.
  return {
    level: 'column',
    prompt: `Use source pack "${pack.name}" to fill missing values.`,
    context: { sourcePackId: pack.id, packName: pack.name },
    nonce,
  };
}

export function useTabeleRightRailPanels(
  args: UseTabeleRightRailPanelsArgs
): UseTabeleRightRailPanelsResult {
  const { tableId, workspaceId, isSuperAdmin, forceEnableForTesting, onAfterApply } = args;
  const [preset, setPreset] = useState<AiEditorPreset | null>(null);
  const presetCounter = React.useRef(0);

  const aiEditorEnabled = forceEnableForTesting === true || isTabeleAiEditorEnabled();
  const qaEnabled = forceEnableForTesting === true || isTabeleQaEnabled();
  const sourcePackEnabled = forceEnableForTesting === true || isTabeleSourcePackEnabled();
  const conversionsEnabled = forceEnableForTesting === true || isTabeleConversionsEnabled();

  const handleOpenInAiEditor = useCallback((s: QaSuggestion) => {
    presetCounter.current += 1;
    setPreset(presetFromSuggestion(s, presetCounter.current));
  }, []);

  const handleUsePackInAiEditor = useCallback((pack: SourcePack) => {
    presetCounter.current += 1;
    setPreset(presetFromPack(pack, presetCounter.current));
  }, []);

  const rightRailPanels = useMemo<TabeleRightRailPanelRenderers>(() => {
    const panels: TabeleRightRailPanelRenderers = {};
    if (!tableId) return panels;

    if (qaEnabled) {
      panels.qaReport = <TabeleQaPanel tableId={tableId} onOpenInAiEditor={handleOpenInAiEditor} />;
    }
    if (sourcePackEnabled && workspaceId) {
      panels.sourcePack = (
        <TabeleSourcePackPanel
          tableId={tableId}
          workspaceId={workspaceId}
          onUseInAiEditor={handleUsePackInAiEditor}
        />
      );
    }
    if (aiEditorEnabled && workspaceId) {
      panels.aiEditor = (
        <TabeleAiEditorPanel
          tableId={tableId}
          workspaceId={workspaceId}
          isSuperAdmin={isSuperAdmin === true}
          {...(preset
            ? {
                initialLevel: preset.level,
                initialPrompt: preset.prompt,
                initialContext: preset.context,
              }
            : {})}
          {...(onAfterApply ? { onAfterApply } : {})}
          // The nonce on key forces a clean remount when a new preset arrives.
          key={preset ? `preset-${preset.nonce}` : 'fresh'}
        />
      );
    }
    if (conversionsEnabled && workspaceId) {
      panels.share = <TabeleSharePanel tableId={tableId} workspaceId={workspaceId} />;
    }
    return panels;
  }, [
    tableId,
    workspaceId,
    qaEnabled,
    aiEditorEnabled,
    sourcePackEnabled,
    conversionsEnabled,
    isSuperAdmin,
    handleOpenInAiEditor,
    handleUsePackInAiEditor,
    onAfterApply,
    preset,
  ]);

  return {
    rightRailPanels,
    panelsActive: Boolean(
      rightRailPanels.qaReport ||
      rightRailPanels.aiEditor ||
      rightRailPanels.sourcePack ||
      rightRailPanels.share
    ),
  };
}
