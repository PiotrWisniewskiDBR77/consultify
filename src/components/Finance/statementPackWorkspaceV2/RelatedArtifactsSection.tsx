/**
 * `RelatedArtifactsSection` — OWN-FIN-007: "Z poziomu konkretnego
 * sprawozdania trzeba dotrzeć do wszystkich analiz, modeli, predykcji i
 * wycen, które z niego powstały… każdy typ ma `+ New`… Relacje muszą wynikać
 * z trwałego lineage, również pośredniego."
 *
 * Dane WYŁĄCZNIE z `GET /versions/:businessVersionId/lineage` (`descendants`)
 * — grupowanie po `targetArtifactType`, klucz relacji = `targetVersionId`
 * (immutable business-version ID), NIGDY nazwa. To jest bezpośrednio
 * testowane w `__tests__/RelatedArtifactsSection.test.tsx` — kontrola
 * negatywna: usuń/zmień nazwę downstream artefaktu w mocku (nazwa nie jest
 * nawet częścią `LineageEdgeDto` — dowód strukturalny, nie tylko
 * behawioralny), relacja i licznik zostają nietknięte.
 *
 * `+ Nowy` woła `onCreateNew(artifactType, sourceBusinessVersionId)` —
 * caller ustawia źródło nowego kreatora na BIEŻĄCĄ wersję (ta funkcja nie zna
 * routingu kreatorów, tylko przekazuje intencję dalej).
 */

import React from 'react';

import type { FinanceArtifactType, LineageEdgeDto } from '@/services/api/financeV2.types';

const RELATED_ARTIFACT_TYPES: readonly FinanceArtifactType[] = [
  'HISTORICAL_ANALYSIS',
  'BASELINE_MODEL',
  'PREDICTION_SCENARIO',
  'VALUATION_CASE',
];

const ARTIFACT_TYPE_LABELS: Record<FinanceArtifactType, string> = {
  STATEMENT_PACK: 'Statement Pack',
  HISTORICAL_ANALYSIS: 'Analysis',
  BASELINE_MODEL: 'Models',
  PREDICTION_SCENARIO: 'Prediction',
  VALUATION_CASE: 'Enterprise valuation',
  REPORT_EXPORT: 'Report Export',
};

export interface RelatedArtifactsSectionProps {
  sourceBusinessVersionId: string;
  descendants: LineageEdgeDto[];
  loading: boolean;
  /** `null` = lineage nie zostało jeszcze wczytane; `[]` (loading=false) = wczytane, naprawdę puste. */
  loaded: boolean;
  onOpenArtifact: (edge: LineageEdgeDto) => void;
  onCreateNew: (artifactType: FinanceArtifactType, sourceBusinessVersionId: string) => void;
}

export function RelatedArtifactsSection(props: RelatedArtifactsSectionProps): React.ReactElement {
  const { sourceBusinessVersionId, descendants, loading, loaded, onOpenArtifact, onCreateNew } = props;

  if (loading) {
    return (
      <div className="space-y-2 p-3" data-testid="related-artifacts-loading">
        {[0, 1].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-c-surface-raised" />
        ))}
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="p-3 text-xs text-c-text-muted" data-testid="related-artifacts-not-loaded">
        Powiązane artefakty nie zostały jeszcze wczytane.
      </div>
    );
  }

  const byType = new Map<FinanceArtifactType, LineageEdgeDto[]>();
  for (const type of RELATED_ARTIFACT_TYPES) byType.set(type, []);
  for (const edge of descendants) {
    if (!byType.has(edge.targetArtifactType)) byType.set(edge.targetArtifactType, []);
    byType.get(edge.targetArtifactType)!.push(edge);
  }

  return (
    <div className="divide-y divide-c-border-subtle" data-testid="related-artifacts-section">
      {RELATED_ARTIFACT_TYPES.map((type) => {
        const edges = byType.get(type) || [];
        return (
          <div key={type} className="px-3 py-2.5" data-testid={`related-artifacts-group-${type}`}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-c-text">
                {ARTIFACT_TYPE_LABELS[type]}
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-c-surface-raised px-1 text-[9px] font-bold text-c-text-secondary"
                  data-testid={`related-artifacts-count-${type}`}
                >
                  {edges.length}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onCreateNew(type, sourceBusinessVersionId)}
                data-testid={`related-artifacts-create-${type}`}
                className="inline-flex min-h-[1.75rem] items-center rounded-lg border border-c-border-subtle px-2 text-[10px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                + Nowy
              </button>
            </div>
            {edges.length === 0 ? (
              <p className="text-[10px] text-c-text-muted">Brak jeszcze żadnego artefaktu tego typu z tego sprawozdania.</p>
            ) : (
              <ul className="space-y-1">
                {edges.map((edge) => (
                  <li key={edge.edgeId}>
                    <button
                      type="button"
                      onClick={() => onOpenArtifact(edge)}
                      data-testid={`related-artifacts-open-${edge.targetVersionId}`}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-[11px] text-c-text-secondary transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <span className="truncate font-mono text-[10px]">v.{edge.targetVersionId.slice(0, 8)}</span>
                      <span className="shrink-0 text-[9px] text-c-text-muted">{edge.transformationKind || edge.edgeType}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default RelatedArtifactsSection;
