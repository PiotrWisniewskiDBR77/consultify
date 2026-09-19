import { describe, expect, it } from 'vitest';

import {
  adaptAuditReportToReportBuilderDocument,
  adaptManagementReportToReportBuilderDocument,
} from '../reportDocumentAdapter.js';

describe('report document adapters', () => {
  it('maps a management report into the Report Builder document shape with every content section', () => {
    const document = adaptManagementReportToReportBuilderDocument({
      id: 'mgr-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      reportType: 'RAID',
      scope: 'PROJECT',
      title: 'RAID report',
      status: 'DRAFT',
      generatedBy: 'user-1',
      aiNarrative: 'Narrative from the management engine.',
      content: {
        statusSummary: { healthStatus: 'AMBER', tasksBlocked: 2 },
        blockers: [{ id: 'b-1', title: 'Open blocker' }],
        pendingDecisions: [{ id: 'd-1', title: 'Decision needed' }],
      },
      createdAt: '2026-09-18T20:00:00.000Z',
      updatedAt: '2026-09-18T20:00:00.000Z',
      currentVersion: 1,
    });

    expect(document.report).toMatchObject({
      id: 'mgr-1',
      sourceType: 'MANAGEMENT_REPORT',
      reportType: 'RAID',
      title: 'RAID report',
    });
    expect(document.sections.map((section) => section.sectionKey)).toEqual([
      'ai_narrative',
      'status_summary',
      'blockers',
      'pending_decisions',
    ]);
    expect(document.sections).toHaveLength(4);
    expect(document.sections[0]).toMatchObject({
      reportId: 'mgr-1',
      contentFormat: 'markdown',
      enabled: true,
    });
  });

  it('maps an audit report payload into the same report + sections document shape', () => {
    const document = adaptAuditReportToReportBuilderDocument({
      id: 'audit-1',
      organizationId: 'org-1',
      programId: 'program-1',
      outputId: 'output-1',
      version: 3,
      reportKind: 'audit_report',
      title: 'Audit report',
      status: 'draft',
      payload: {
        generatedAt: '2026-09-18T20:00:00.000Z',
        sections: [
          { id: 'executive_summary', title: 'Executive summary', kind: 'text', content: 'Summary text' },
          { id: 'findings', title: 'Findings', kind: 'table', content: [{ id: 'f-1', title: 'Finding' }] },
          { id: 'plan', title: 'Plan', kind: 'list', content: ['Verify evidence'] },
        ],
      },
      createdBy: 'user-1',
      createdAt: '2026-09-18T19:00:00.000Z',
      updatedAt: '2026-09-18T20:00:00.000Z',
    });

    expect(document.report).toMatchObject({
      id: 'audit-1',
      sourceType: 'AUDIT_REPORT',
      sourceId: 'output-1',
      reportType: 'audit_report',
    });
    expect(document.sections.map((section) => section.sectionKey)).toEqual([
      'executive_summary',
      'findings',
      'plan',
    ]);
    expect(document.sections).toHaveLength(3);
    expect(document.sections[1].generatedContent).toContain('Finding');
  });
});
