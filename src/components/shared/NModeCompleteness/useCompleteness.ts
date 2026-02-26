/**
 * NMode Completeness — Hook
 *
 * Calculates completeness for a given artifact based on config and data.
 *
 * @see V3-K01: N-mode required sections/fields + completeness + AI assist
 */

import { useMemo } from 'react';

import { getCompletenessConfig } from './completenessConfigs';
import type {
  ArtifactType,
  CompletenessConfig,
  CompletenessResult,
  MissingItem,
  RequiredField,
} from './types';

export interface UseCompletenessOptions {
  /** Override config (e.g. from initiative level template). When provided, used instead of getCompletenessConfig. */
  configOverride?: CompletenessConfig | null;
}

function getValueAtPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isFilled(value: unknown, type: RequiredField['type']): boolean {
  if (value === undefined || value === null) return false;
  if (type === 'text' || type === 'rich_text') {
    return typeof value === 'string' && value.trim().length > 0;
  }
  if (type === 'number') {
    return typeof value === 'number' && !Number.isNaN(value);
  }
  if (type === 'date') {
    if (typeof value === 'string') return value.trim().length > 0;
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    return false;
  }
  if (type === 'select') {
    return value !== '' && value !== undefined && value !== null;
  }
  if (type === 'list') {
    return Array.isArray(value) ? value.length > 0 : false;
  }
  return true;
}

export function useCompleteness(
  artifactType: ArtifactType,
  status: string,
  data: Record<string, unknown>,
  options?: UseCompletenessOptions
): CompletenessResult {
  return useMemo(() => {
    const config = options?.configOverride ?? getCompletenessConfig(artifactType, status);
    if (!config) {
      return {
        score: 100,
        totalRequired: 0,
        totalFilled: 0,
        missingItems: [],
        criticalMissing: [],
        gateReady: true,
      };
    }

    const missingItems: MissingItem[] = [];
    let totalFilled = 0;

    for (const section of config.requiredSections) {
      for (const field of section.fields) {
        const value = getValueAtPath(data, field.fieldPath);
        if (!isFilled(value, field.type)) {
          missingItems.push({
            fieldId: field.id,
            sectionId: field.sectionId,
            sectionLabel: section.label,
            fieldLabel: field.label,
            fieldPath: field.fieldPath,
            isCritical: field.isCritical,
          });
        } else {
          totalFilled++;
        }
      }
    }

    const totalRequired = config.requiredSections.reduce((sum, s) => sum + s.fields.length, 0);
    const criticalMissing = missingItems.filter((m) => m.isCritical);
    const gateReady = criticalMissing.length === 0;
    const score = totalRequired === 0 ? 100 : Math.round((totalFilled / totalRequired) * 100);

    return {
      score,
      totalRequired,
      totalFilled,
      missingItems,
      criticalMissing,
      gateReady,
    };
  }, [artifactType, status, data]);
}
