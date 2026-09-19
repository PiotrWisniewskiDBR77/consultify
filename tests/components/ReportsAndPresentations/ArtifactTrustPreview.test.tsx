/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TrustStatePreviewSection } from '../../../src/components/ReportsAndPresentations/TrustStatePreviewSection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

/**
 * D-34b (Wpis 198): ten plik asertował na `previews/PresentationPreview` i
 * `previews/ReportPreview` — 8 martwych plików preview usunięto w `00e27b069c`
 * (0 realnych referencji). ŻYWĄ powierzchnią tej samej gramatyki zaufania jest
 * współdzielony `TrustStatePreviewSection` (wołany z ReportsTabContent:597,
 * PresentationsTabContent i OutputsAggregateTabContent). Przepisano na żywy
 * komponent BEZ kasowania asercji:
 *   - „Trust state", stany Execution/Review, granica zaufania i ślad eksportu
 *     → bez zmian (te same teksty renderuje TrustStatePreviewSection);
 *   - goły id biegu (`exec-1`/`exec-2`) → FALA 1 (2026-07-27) schowała UUID za
 *     przyciskiem „Copy ID" z pełną wartością w tooltipie, więc asercja czyta
 *     `title` przycisku zamiast gołego tekstu (intencja „id biegu jest
 *     surfaced" zachowana).
 */
describe('Artifact trust previews', () => {
  it('renders execution and review trust signals for reports', () => {
    const governance = {
      visibilityScope: 'review_shared',
      publishState: 'in_review',
      reviewGateCount: 2,
      executionState: 'completed',
      executionRunId: 'exec-1',
      originLinks: [{ linkId: 'link-1' }],
      authority: 'report_builder',
      canManageAccess: true,
      exportHistory: [{ exportId: 'exp-1' }],
      sourceRefs: [{ artifact_id: 'src-1' }],
      validationState: 'validated',
      executionAuthority: 'report_builder',
      reviewAuthority: 'artifact_review',
      originSummary: { type: 'report' },
    } as any;

    render(
      <TrustStatePreviewSection
        governance={governance}
        artifactId="artifact-1"
        exportFormats={['pdf']}
      />
    );

    expect(screen.getByText('Trust state')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();
    // FALA 1: id biegu pod przyciskiem „Copy ID", pełna wartość w tooltipie.
    expect(screen.getByTitle('exec-1')).toBeInTheDocument();
    expect(screen.getByText(/Execution: report_builder/i)).toBeInTheDocument();
    expect(screen.getByText('1 · —')).toBeInTheDocument();
  });

  it('renders execution and review trust signals for presentations', () => {
    const governance = {
      visibilityScope: 'private',
      publishState: 'private_draft',
      reviewGateCount: 0,
      executionState: 'completed',
      executionRunId: 'exec-2',
      originLinks: [{ linkId: 'link-2' }],
      authority: 'presentations_runtime',
      canManageAccess: false,
      exportHistory: [{ exportId: 'exp-2' }],
      sourceRefs: [{ artifact_id: 'src-2', artifact_type: 'tool', artifact_name: 'Source' }],
      validationState: 'validated',
      executionAuthority: 'presentations_runtime',
      reviewAuthority: 'artifact_review',
      originSummary: { type: 'presentation' },
    } as any;

    render(
      <TrustStatePreviewSection
        governance={governance}
        artifactId="artifact-2"
        exportFormats={['pptx']}
      />
    );

    expect(screen.getByText('Trust state')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Private Draft')).toBeInTheDocument();
    // FALA 1: id biegu pod przyciskiem „Copy ID", pełna wartość w tooltipie.
    expect(screen.getByTitle('exec-2')).toBeInTheDocument();
    expect(screen.getByText(/Execution: presentations_runtime/i)).toBeInTheDocument();
    expect(screen.getByText('1 · —')).toBeInTheDocument();
  });
});
