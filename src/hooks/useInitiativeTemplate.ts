/**
 * useInitiativeTemplate — Integrates initiative level templates with completeness
 *
 * V3-F01: Template-driven N-mode per InitiativeLevel.
 * Uses useCompleteness with level-specific config.
 */

import { useCallback, useMemo } from 'react';

import {
  buildCompletenessConfigFromTemplate,
  getConfigKeyForStatus,
  getInitiativeLevelTemplate,
} from '@/components/Initiatives/templates/initiativeLevelTemplates';
import type { InitiativeLevel } from '@/components/Initiatives/templates/types';
import type { CompletenessResult, MissingItem } from '@/components/shared/NModeCompleteness';
import { useCompleteness } from '@/components/shared/NModeCompleteness';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

export interface UseInitiativeTemplateResult {
  template: ReturnType<typeof getInitiativeLevelTemplate>;
  visibleSections: string[];
  completeness: CompletenessResult;
  canTransitionTo: (nextStatus: string) => { allowed: boolean; blockers: MissingItem[] };
  /** Call when completeness is viewed (e.g. pill click, drawer open) */
  trackCompletenessViewed: () => void;
  /** Call when a section is completed (e.g. all required fields filled) */
  trackSectionCompleted: (sectionId: string) => void;
}

export function useInitiativeTemplate(
  level: InitiativeLevel | null | undefined,
  status: string,
  data: Record<string, unknown>
): UseInitiativeTemplateResult {
  const template = useMemo(() => (level ? getInitiativeLevelTemplate(level) : null), [level]);

  const configOverride = useMemo(() => {
    if (!template) return null;
    return buildCompletenessConfigFromTemplate(template, status);
  }, [template, status]);

  const completeness = useCompleteness(
    'initiative',
    status,
    data,
    configOverride ? { configOverride } : undefined
  );

  const visibleSections = useMemo(() => template?.visibleSections ?? [], [template]);

  const canTransitionTo = useCallback(
    (nextStatus: string): { allowed: boolean; blockers: MissingItem[] } => {
      if (!template) return { allowed: true, blockers: [] };

      const nextConfigKey = getConfigKeyForStatus(nextStatus);
      const nextFields = template.requiredFieldsByStatus[nextConfigKey];
      if (!nextFields || nextFields.length === 0) {
        return { allowed: true, blockers: [] };
      }

      const nextConfig = buildCompletenessConfigFromTemplate(template, nextStatus);
      if (!nextConfig) return { allowed: true, blockers: [] };

      const blockers: MissingItem[] = [];
      for (const section of nextConfig.requiredSections) {
        for (const field of section.fields) {
          if (!field.isCritical) continue;
          const value = getValueAtPath(data, field.fieldPath);
          if (!isFilled(value, field.type)) {
            blockers.push({
              fieldId: field.id,
              sectionId: field.sectionId,
              sectionLabel: section.label,
              fieldLabel: field.label,
              fieldPath: field.fieldPath,
              isCritical: true,
            });
          }
        }
      }
      return { allowed: blockers.length === 0, blockers };
    },
    [template, data]
  );

  const trackCompletenessViewed = useCallback(() => {
    if (level) {
      trackFunnelEvent('initiative_completeness_viewed', {
        level,
        score: completeness.score,
      });
    }
  }, [level, completeness.score]);

  const trackSectionCompleted = useCallback(
    (sectionId: string) => {
      if (level) {
        trackFunnelEvent('initiative_section_completed', { sectionId, level });
      }
    },
    [level]
  );

  return {
    template,
    visibleSections,
    completeness,
    canTransitionTo,
    trackCompletenessViewed,
    trackSectionCompleted,
  };
}

function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isFilled(value: unknown, type: 'text' | 'rich_text' | 'select' | 'list'): boolean {
  if (value === undefined || value === null) return false;
  if (type === 'text' || type === 'rich_text') {
    return typeof value === 'string' && value.trim().length > 0;
  }
  if (type === 'select') {
    return value !== '' && value !== undefined && value !== null;
  }
  if (type === 'list') {
    return Array.isArray(value) ? value.length > 0 : false;
  }
  return true;
}
