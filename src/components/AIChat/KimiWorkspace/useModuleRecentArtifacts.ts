/**
 * useModuleRecentArtifacts — returns recent artifacts filtered by lane kind.
 * Wraps useArtifactOutputsList('mine') from the Outputs Library.
 */

import { useMemo } from 'react';

import type { UnifiedOutputRow } from '@/components/ReportsAndPresentations/types';
import { useArtifactOutputsList } from '@/components/ReportsAndPresentations/useRapData';

import type { KimiLane } from './KimiWorkspaceShell';

const LANE_TO_KIND: Record<KimiLane, UnifiedOutputRow['kind']> = {
  excele: 'sheet',
  prezentacje: 'presentation',
  // Tabele uses the existing 'sheet' artifact kind. Sprint 5 may introduce
  // a dedicated 'table' kind — keeping 'sheet' is additive-safe today.
  tabele: 'sheet',
};

export function useModuleRecentArtifacts(lane: KimiLane, limit = 6) {
  const { rows, loading, error, refetch } = useArtifactOutputsList('mine');
  const targetKind = LANE_TO_KIND[lane];

  const filtered = useMemo(
    () => rows.filter((r: UnifiedOutputRow) => r.kind === targetKind).slice(0, limit),
    [rows, targetKind, limit]
  );

  return { artifacts: filtered, loading, error, refetch };
}
