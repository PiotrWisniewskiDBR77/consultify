/**
 * @vitest-environment jsdom
 *
 * `RelatedArtifactsSection` (OWN-FIN-007) — dowodzi grupowania po typie,
 * liczników, `+ Nowy` z bieżącym businessVersionId jako źródłem, i że
 * identyfikacja artefaktu jest po `targetVersionId` (immutable), NIGDY po
 * nazwie — `LineageEdgeDto` w ogóle nie niesie pola nazwy, więc ten
 * komponent STRUKTURALNIE nie może renderować po nazwie.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { LineageEdgeDto } from '@/services/api/financeV2.types';

import { RelatedArtifactsSection } from '../RelatedArtifactsSection';

function edge(overrides: Partial<LineageEdgeDto> & { edgeId: string; targetVersionId: string }): LineageEdgeDto {
  return {
    edgeId: overrides.edgeId,
    sourceVersionId: 'bv-statement-pack-1',
    sourceArtifactType: 'STATEMENT_PACK',
    targetVersionId: overrides.targetVersionId,
    targetArtifactType: 'HISTORICAL_ANALYSIS',
    edgeType: 'derived_from',
    transformationKind: 'analysis_from_statement',
    assumptionSnapshotHash: null,
    computeRunId: null,
    authorId: 'user-1',
    createdAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('RelatedArtifactsSection', () => {
  it('shows a loading state distinctly from empty/not-loaded', () => {
    render(
      <RelatedArtifactsSection
        sourceBusinessVersionId="bv-1"
        descendants={[]}
        loading
        loaded={false}
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
      />
    );
    expect(screen.getByTestId('related-artifacts-loading')).toBeInTheDocument();
  });

  it('distinguishes "not yet loaded" from "loaded and genuinely empty" — MISSING != zero', () => {
    render(
      <RelatedArtifactsSection
        sourceBusinessVersionId="bv-1"
        descendants={[]}
        loading={false}
        loaded={false}
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
      />
    );
    expect(screen.getByTestId('related-artifacts-not-loaded')).toBeInTheDocument();
  });

  it('groups descendants by artifact type with correct counts, and shows zero-state for empty types', () => {
    render(
      <RelatedArtifactsSection
        sourceBusinessVersionId="bv-1"
        descendants={[
          edge({ edgeId: 'e1', targetVersionId: 'bv-analysis-1', targetArtifactType: 'HISTORICAL_ANALYSIS' }),
          edge({ edgeId: 'e2', targetVersionId: 'bv-analysis-2', targetArtifactType: 'HISTORICAL_ANALYSIS' }),
          edge({ edgeId: 'e3', targetVersionId: 'bv-model-1', targetArtifactType: 'BASELINE_MODEL' }),
        ]}
        loading={false}
        loaded
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
      />
    );
    expect(screen.getByTestId('related-artifacts-count-HISTORICAL_ANALYSIS')).toHaveTextContent('2');
    expect(screen.getByTestId('related-artifacts-count-BASELINE_MODEL')).toHaveTextContent('1');
    expect(screen.getByTestId('related-artifacts-count-PREDICTION_SCENARIO')).toHaveTextContent('0');
    expect(screen.getByTestId('related-artifacts-count-VALUATION_CASE')).toHaveTextContent('0');
  });

  it('"+ Nowy" calls onCreateNew with the artifact type and the CURRENT source businessVersionId', () => {
    const onCreateNew = vi.fn();
    render(
      <RelatedArtifactsSection
        sourceBusinessVersionId="bv-statement-pack-42"
        descendants={[]}
        loading={false}
        loaded
        onOpenArtifact={() => {}}
        onCreateNew={onCreateNew}
      />
    );
    fireEvent.click(screen.getByTestId('related-artifacts-create-BASELINE_MODEL'));
    expect(onCreateNew).toHaveBeenCalledWith('BASELINE_MODEL', 'bv-statement-pack-42');
  });

  it('opening an artifact passes the full edge (caller reads targetVersionId, not a name)', () => {
    const onOpenArtifact = vi.fn();
    const e = edge({ edgeId: 'e1', targetVersionId: 'bv-analysis-1' });
    render(
      <RelatedArtifactsSection
        sourceBusinessVersionId="bv-1"
        descendants={[e]}
        loading={false}
        loaded
        onOpenArtifact={onOpenArtifact}
        onCreateNew={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('related-artifacts-open-bv-analysis-1'));
    expect(onOpenArtifact).toHaveBeenCalledWith(e);
  });

  // KONTROLA NEGATYWNA (OWN-FIN-007): "usuń/zmień nazwę artefaktu potomnego w
  // mocku -> sekcja nadal go pokazuje" — `LineageEdgeDto` nie niesie ŻADNEGO
  // pola nazwy (dowód strukturalny: interfejs w financeV2.types.ts), więc
  // symulujemy "rename" zmieniając JEDYNE pole zbliżone do etykiety
  // (`transformationKind`) i dowodzimy, że relacja (targetVersionId, licznik)
  // pozostaje identyczna — bo klucz jest immutable ID, nie etykieta.
  it('NEGATIVE CONTROL — changing the only label-like field (transformationKind) does not change identity/count, because keys are immutable IDs', () => {
    const before = edge({ edgeId: 'e1', targetVersionId: 'bv-analysis-1', transformationKind: 'analysis_from_statement' });
    const { rerender } = render(
      <RelatedArtifactsSection
        sourceBusinessVersionId="bv-1"
        descendants={[before]}
        loading={false}
        loaded
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
      />
    );
    expect(screen.getByTestId('related-artifacts-count-HISTORICAL_ANALYSIS')).toHaveTextContent('1');
    expect(screen.getByTestId('related-artifacts-open-bv-analysis-1')).toBeInTheDocument();

    const renamed = edge({ edgeId: 'e1', targetVersionId: 'bv-analysis-1', transformationKind: 'RENAMED_OR_DELETED_DOWNSTREAM_LABEL' });
    rerender(
      <RelatedArtifactsSection
        sourceBusinessVersionId="bv-1"
        descendants={[renamed]}
        loading={false}
        loaded
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
      />
    );
    // Relacja wciąż widoczna pod tym samym immutable ID, count niezmieniony.
    expect(screen.getByTestId('related-artifacts-count-HISTORICAL_ANALYSIS')).toHaveTextContent('1');
    expect(screen.getByTestId('related-artifacts-open-bv-analysis-1')).toBeInTheDocument();
  });
});
