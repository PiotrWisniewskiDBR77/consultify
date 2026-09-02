/**
 * Pure helper extracted from ExecutionHub's Portfolio-tab preview.
 *
 * Builds the `relations` prop StandardPreview needs to show where an
 * initiative came from — a human label (never the raw sourceType slug)
 * optionally combined with the source framework (e.g. "Assessment · DRD").
 *
 * Kept separate from ExecutionHub.tsx (6000+ lines, many providers needed to
 * mount) so the mapping can be render-tested directly against a real
 * StandardPreview mount instead of a source-text grep.
 */
import { getSourceDisplayLabel } from '../Initiatives/InitiativeSourceLink';
import type { RelationItem } from '../standard/StandardPreview';

export interface ExecutionSourceRelationInput {
  sourceType?: string | null;
  sourceFramework?: unknown;
}

/**
 * @param input           raw source fields off the selected initiative row
 * @param sourceLabelPrefix localized "Source" label, e.g. t('common.source', 'Source')
 */
export function buildExecutionSourceRelations(
  input: ExecutionSourceRelationInput,
  sourceLabelPrefix: string
): RelationItem[] {
  const sourceLabel = input.sourceType ? getSourceDisplayLabel(input.sourceType) : '';
  if (!sourceLabel) return [];

  const sourceFrameworkValue = String(input.sourceFramework || '').trim();
  return [
    {
      label: `${sourceLabelPrefix}: ${
        sourceFrameworkValue ? `${sourceLabel} · ${sourceFrameworkValue}` : sourceLabel
      }`,
    },
  ];
}
