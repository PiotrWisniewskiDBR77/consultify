import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/standard/StandardArtifactShell', () => ({
  StandardArtifactShell: ({ sections }: any) => (
    <div data-testid="standard-artifact-shell">
      {sections.map((section: any) => (
        <section key={section.id} data-testid={`shell-section-${section.id}`}>
          {section.component}
        </section>
      ))}
    </div>
  ),
}));

vi.mock('@/components/standard/DocumentCardMenu5', () => ({
  DocumentCardMenu5: () => null,
}));

vi.mock('@/components/standard/ArtifactPropertiesTable', () => ({
  ArtifactPropertiesTable: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('../../../../services/api', () => ({
  Api: {},
}));

vi.mock('../../../../store/useAppStore', () => ({
  useAppStore: (selector: any) => selector({ currentProjectId: null, currentUser: { organizationId: 'org-1' } }),
}));

import { ManagementReportCard } from '../ManagementReportsView';

describe('ManagementReportCard report-builder document adapter', () => {
  const baseReport: any = {
    id: 'mgr-1',
    organizationId: 'org-1',
    reportType: 'RAID',
    scope: 'PROJECT',
    title: 'A2B_RAPORT',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-18',
    status: 'DRAFT',
    generatedBy: 'user-1',
    generatedByName: 'User One',
    content: { executiveSummary: 'A2B_LEGACY_CONTENT' },
    aiNarrative: 'A2B_LEGACY_NARRATIVE',
    aiWarnings: [],
    createdAt: '2026-09-18T20:00:00.000Z',
    updatedAt: '2026-09-18T20:00:00.000Z',
  };

  it('renders adapter sections from reportBuilderDocument instead of the legacy one-section report body', () => {
    render(
      <ManagementReportCard
        report={{
          ...baseReport,
          reportBuilderDocument: {
            report: {
              id: 'mgr-1',
              sourceType: 'MANAGEMENT_REPORT',
              sourceId: 'mgr-1',
              title: 'A2B_RAPORT',
              reportType: 'RAID',
              status: 'DRAFT',
            },
            sections: [
              {
                id: 'mgr-1:status_summary',
                reportId: 'mgr-1',
                sectionKey: 'status_summary',
                sectionType: 'content',
                title: 'A2B_STATUS',
                orderIndex: 0,
                enabled: true,
                required: true,
                length: 'medium',
                language: 'business',
                generatedContent: 'A2B_STATUS_AMBER',
                contentFormat: 'markdown',
              },
              {
                id: 'mgr-1:blockers',
                reportId: 'mgr-1',
                sectionKey: 'blockers',
                sectionType: 'content',
                title: 'A2B_BLOCKERS',
                orderIndex: 1,
                enabled: true,
                required: false,
                length: 'medium',
                language: 'business',
                generatedContent: 'A2B_BLOCKER',
                contentFormat: 'markdown',
              },
            ],
          },
        }}
        onBack={() => undefined}
        onExportPDF={async () => ''}
        onExportPPTX={async () => ''}
        onShare={async () => ({ shareUrl: '', expiresAt: '' })}
      >
        <div>A2B_LEGACY_BODY</div>
      </ManagementReportCard>
    );

    expect(screen.getByTestId('report-builder-document-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('report-builder-document-section-status_summary')).toHaveTextContent('A2B_STATUS_AMBER');
    expect(screen.getByTestId('report-builder-document-section-blockers')).toHaveTextContent('A2B_BLOCKER');
    expect(screen.queryByText('A2B_LEGACY_BODY')).not.toBeInTheDocument();
  });
});
