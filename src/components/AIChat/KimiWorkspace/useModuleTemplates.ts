/**
 * useModuleTemplates — returns templates filtered by lane type.
 * Wraps useTemplates() from the Outputs Library and filters by report | sheet | presentation.
 */

import { useMemo } from 'react';

import type { TemplateItem, TemplateType } from '@/components/ReportsAndPresentations/types';
import { useTemplates } from '@/components/ReportsAndPresentations/useRapData';

import type { KimiLane } from './KimiWorkspaceShell';

const LANE_TO_TEMPLATE_TYPE: Record<KimiLane, TemplateType> = {
  excele: 'sheet',
  prezentacje: 'presentation',
  // Tabele uses the existing 'sheet' template family. Sprint 5 may introduce
  // a dedicated 'table' family — keeping 'sheet' is additive-safe today.
  tabele: 'sheet',
};

export function useModuleTemplates(lane: KimiLane) {
  const { templates, loading, error, fetchTemplates } = useTemplates();
  const targetType = LANE_TO_TEMPLATE_TYPE[lane];

  const filtered = useMemo(
    () => templates.filter((t: TemplateItem) => t.type === targetType),
    [templates, targetType]
  );

  return { templates: filtered, loading, error, fetchTemplates };
}
