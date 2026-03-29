/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  PresentationPreviewBody,
  PresentationPreviewFooter,
} from '../../../src/components/ReportsAndPresentations/previews/PresentationPreview';
import {
  ReportPreviewBody,
  ReportPreviewFooter,
} from '../../../src/components/ReportsAndPresentations/previews/ReportPreview';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

describe('Artifact trust previews', () => {
  it('renders execution and review trust signals for reports', () => {
    const report = {
      id: 'report-1',
      artifactId: 'artifact-1',
      title: 'Board report',
      reportType: 'R1' as const,
      status: 'ready' as const,
      owner: 'user-1',
      createdAt: '2026-03-29T08:00:00.000Z',
      updatedAt: '2026-03-29T08:30:00.000Z',
      exportFormats: ['pdf'],
      sourceRefs: [{ artifact_id: 'src-1' }],
      governance: {
        visibilityScope: 'review_shared' as const,
        publishState: 'in_review',
        reviewGateCount: 2,
        executionState: 'completed',
        executionRunId: 'exec-1',
        originLinks: [{ linkId: 'link-1' }],
        authority: 'report_builder',
        canManageAccess: true,
        exportHistory: [{ exportId: 'exp-1' }],
      },
    };

    render(
      <>
        <ReportPreviewBody report={report} />
        <ReportPreviewFooter report={report} />
      </>
    );

    expect(screen.getByText(/Execution state: completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Publish state: in_review/i)).toBeInTheDocument();
    expect(screen.getByText(/Execution: completed/i)).toBeInTheDocument();
    expect(screen.getByText(/origin links/i)).toBeInTheDocument();
    expect(screen.getByText(/Export authority: report_builder/i)).toBeInTheDocument();
    expect(screen.getByText(/export traces/i)).toBeInTheDocument();
  });

  it('renders execution and review trust signals for presentations', () => {
    const presentation = {
      id: 'deck-1',
      artifactId: 'artifact-2',
      title: 'Executive deck',
      sourceType: 'tool' as const,
      owner: 'user-2',
      status: 'ready' as const,
      presentationMode: 'briefing',
      createdAt: '2026-03-29T08:00:00.000Z',
      updatedAt: '2026-03-29T08:30:00.000Z',
      slideCount: 12,
      exportFormats: ['pptx'],
      sourceRefs: [{ artifact_id: 'src-2', artifact_type: 'tool', artifact_name: 'Source' }],
      governance: {
        visibilityScope: 'private' as const,
        publishState: 'private_draft',
        reviewGateCount: 0,
        executionState: 'completed',
        executionRunId: 'exec-2',
        originLinks: [{ linkId: 'link-2' }],
        authority: 'presentations_runtime',
        canManageAccess: false,
        exportHistory: [{ exportId: 'exp-2' }],
      },
    };

    render(
      <>
        <PresentationPreviewBody presentation={presentation} />
        <PresentationPreviewFooter presentation={presentation} />
      </>
    );

    expect(screen.getByText(/Execution state: completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Publish state: private_draft/i)).toBeInTheDocument();
    expect(screen.getByText(/Execution: completed/i)).toBeInTheDocument();
    expect(screen.getByText(/origin links/i)).toBeInTheDocument();
    expect(screen.getByText(/Export authority: presentations_runtime/i)).toBeInTheDocument();
    expect(screen.getByText(/export traces/i)).toBeInTheDocument();
  });
});
