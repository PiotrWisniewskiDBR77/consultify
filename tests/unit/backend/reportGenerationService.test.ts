/**
 * ReportGenerationService - Unit Tests
 *
 * Current implementation exposes:
 * - `generateSectionContent`
 * - `generateFullReport`
 * - `regenerateSection`
 *
 * These tests focus on the public API and mock DB + ReportBuilderService.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  run: vi.fn((sql: string, params: any, cb?: any) => {
    const callback = typeof params === 'function' ? params : cb;
    if (callback) callback.call({ changes: 1 }, null);
  }),
  get: vi.fn((sql: string, params: any, cb?: any) => {
    const callback = typeof params === 'function' ? params : cb;
    if (callback) callback(null, null);
  }),
}));

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => mockDb,
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-report-uuid'),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../server/src/services/reportBuilderService.js', () => ({
  default: {
    getReport: vi.fn(),
    getSourceDataForReport: vi.fn(),
    updateReportStatus: vi.fn(),
  },
}));

import ReportBuilderService from '../../../server/src/services/reportBuilderService.js';
import {
  generateFullReport,
  generateSectionContent,
} from '../../../server/src/services/reportGenerationService';

describe('ReportGenerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates deterministic JSON for matrix sections', async () => {
    (ReportBuilderService as any).getReport.mockResolvedValue({
      report: { companyContext: {} },
      sections: [
        {
          sectionKey: 'matrix',
          sectionType: 'matrix',
          title: 'Matrix',
          length: 'short',
          enabled: true,
          orderIndex: 0,
        },
      ],
    });

    (ReportBuilderService as any).getSourceDataForReport.mockResolvedValue({
      assessment: {
        assessmentType: 'DRD',
        name: 'Test Assessment',
        scores: { axes: [{ axisId: 'a1', axisName: 'Axis 1', score: 3, maxScore: 7 }] },
        answers: {},
      },
      axesData: {},
    });

    const result = await generateSectionContent('report-1', 'matrix', 'org-1', 'user-1');
    expect(result.tokensUsed).toBe(0);
    const parsed = JSON.parse(result.content);
    expect(parsed.type).toBe('assessment_matrix');
    expect(mockDb.run).toHaveBeenCalled();
  });

  it('generates full report and updates status', async () => {
    (ReportBuilderService as any).getReport.mockResolvedValue({
      report: { companyContext: {} },
      sections: [
        {
          sectionKey: 'matrix',
          sectionType: 'matrix',
          title: 'Matrix',
          length: 'short',
          enabled: true,
          orderIndex: 0,
          generatedContent: null,
        },
      ],
    });

    (ReportBuilderService as any).getSourceDataForReport.mockResolvedValue({
      assessment: {
        assessmentType: 'DRD',
        name: 'Test Assessment',
        scores: { axes: [{ axisId: 'a1', axisName: 'Axis 1', score: 3, maxScore: 7 }] },
        answers: {},
      },
      axesData: {},
    });

    const res = await generateFullReport('report-1', 'org-1', 'user-1', { regenerateAll: true });
    expect(res.generatedSections).toContain('matrix');
    expect((ReportBuilderService as any).updateReportStatus).toHaveBeenCalledWith(
      'report-1',
      'GENERATING',
      'user-1'
    );
    expect((ReportBuilderService as any).updateReportStatus).toHaveBeenCalledWith(
      'report-1',
      'GENERATED',
      'user-1'
    );
  });
});
