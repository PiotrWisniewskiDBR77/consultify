/**
 * @vitest-environment jsdom
 *
 * The retired per-format preview bodies were intentionally removed when the
 * Materials tabs adopted StandardPreview. Trust state now has one canonical
 * renderer shared by reports, presentations and aggregate outputs.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TrustStatePreviewSection } from '../../../src/components/ReportsAndPresentations/TrustStatePreviewSection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) => {
      const value =
        typeof fallback === 'string'
          ? fallback
          : fallback?.count === 1 && fallback?.defaultValue_one
            ? fallback.defaultValue_one
            : (fallback?.defaultValue ?? key);
      return String(value).replace('{{count}}', String(fallback?.count ?? ''));
    },
    i18n: { language: 'en' },
  }),
}));

function renderTrustState(overrides: Record<string, unknown>) {
  render(
    <TrustStatePreviewSection
      artifactId="artifact-1"
      exportFormats={['pptx']}
      governance={
        {
          visibilityScope: 'review_shared',
          publishState: 'in_review',
          reviewGateCount: 2,
          validationState: 'validated',
          executionState: 'completed',
          executionRunId: 'exec-1',
          originLinks: [{ linkId: 'link-1' }],
          sourceRefs: [{ artifact_id: 'src-1' }],
          executionAuthority: 'presentations_runtime',
          reviewAuthority: 'artifact_review',
          originSummary: { type: 'presentation' },
          canManageAccess: true,
          exportHistory: [{ exportId: 'exp-1', status: 'completed' }],
          ...overrides,
        } as any
      }
    />
  );
}

describe('Artifact trust preview', () => {
  it('renders execution, review, lineage and authority through the canonical renderer', () => {
    renderTrustState({});

    expect(screen.getByText('Trust state')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(screen.getByText('1 origin · 1 source')).toBeInTheDocument();
    expect(screen.getByText(/Execution: presentations_runtime/i)).toBeInTheDocument();
    expect(screen.getByText(/Review: Artifact Review/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy ID' })).toHaveLength(2);
    expect(screen.queryByText('exec-1')).not.toBeInTheDocument();
  });

  it('renders private, read-only presentation governance without fabricating data', () => {
    renderTrustState({
      visibilityScope: 'private',
      publishState: 'private_draft',
      reviewGateCount: 0,
      canManageAccess: false,
      originLinks: [],
      sourceRefs: [],
      exportHistory: [],
    });

    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('Private Draft')).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
