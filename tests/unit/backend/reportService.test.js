/**
 * Report Service Unit Tests
 *
 * Tests for report generation and management.
 *
 * @module tests/unit/backend/reportService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create report service implementation
const createReportService = () => {
  const reports = new Map();
  const templates = new Map([
    [
      'executive_summary',
      {
        id: 'executive_summary',
        name: 'Executive Summary',
        sections: ['overview', 'metrics', 'recommendations'],
      },
    ],
    [
      'project_status',
      { id: 'project_status', name: 'Project Status', sections: ['progress', 'risks', 'timeline'] },
    ],
    [
      'financial',
      { id: 'financial', name: 'Financial Report', sections: ['budget', 'spending', 'forecast'] },
    ],
  ]);

  return {
    // Generate report
    generate: async (data) => {
      if (!data.templateId || !data.projectId) {
        throw new Error('Template ID and Project ID required');
      }

      const template = templates.get(data.templateId);
      if (!template) throw new Error('Template not found');

      const id = `report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const report = {
        id,
        templateId: data.templateId,
        templateName: template.name,
        projectId: data.projectId,
        title: data.title || template.name,
        parameters: data.parameters || {},
        format: data.format || 'pdf',
        status: 'generating',
        sections: template.sections.map((s) => ({ name: s, content: null })),
        generatedAt: null,
        createdAt: new Date().toISOString(),
        createdBy: data.createdBy,
      };

      reports.set(id, report);

      // Simulate generation (in real app this would be async)
      setTimeout(() => {
        report.status = 'completed';
        report.generatedAt = new Date().toISOString();
        report.fileUrl = `/reports/${id}.${report.format}`;
        reports.set(id, report);
      }, 10);

      return report;
    },

    // Get report by ID
    getById: async (id) => {
      return reports.get(id) || null;
    },

    // List reports for project
    listByProject: async (projectId, options = {}) => {
      const { limit = 10, offset = 0 } = options;

      return Array.from(reports.values())
        .filter((r) => r.projectId === projectId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(offset, offset + limit);
    },

    // Get available templates
    getTemplates: async () => {
      return Array.from(templates.values());
    },

    // Schedule recurring report
    schedule: async (data) => {
      const schedule = {
        id: `sched-${Date.now()}`,
        templateId: data.templateId,
        projectId: data.projectId,
        frequency: data.frequency || 'weekly',
        recipients: data.recipients || [],
        nextRun: data.nextRun || new Date().toISOString(),
        active: true,
      };
      return schedule;
    },

    // Delete report
    delete: async (id) => {
      return reports.delete(id);
    },

    // Export to different format
    export: async (reportId, format) => {
      const report = reports.get(reportId);
      if (!report) throw new Error('Report not found');
      if (report.status !== 'completed') throw new Error('Report not ready');

      return {
        reportId,
        format,
        fileUrl: `/reports/${reportId}.${format}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    },

    // Clear for testing
    clear: () => reports.clear(),
  };
};

describe('ReportService', () => {
  let reportService;

  beforeEach(() => {
    reportService = createReportService();
  });

  describe('Report Generation', () => {
    it('should generate a report from template', async () => {
      const report = await reportService.generate({
        templateId: 'executive_summary',
        projectId: 'proj-1',
        title: 'Q4 Executive Summary',
        createdBy: 'user-1',
      });

      expect(report.id).toBeDefined();
      expect(report.templateName).toBe('Executive Summary');
      expect(report.status).toBe('generating');
      expect(report.sections).toHaveLength(3);
    });

    it('should require template and project', async () => {
      await expect(reportService.generate({})).rejects.toThrow(
        'Template ID and Project ID required'
      );
    });

    it('should reject invalid template', async () => {
      await expect(
        reportService.generate({
          templateId: 'invalid',
          projectId: 'proj-1',
        })
      ).rejects.toThrow('Template not found');
    });
  });

  describe('Report Retrieval', () => {
    it('should get report by ID', async () => {
      const created = await reportService.generate({
        templateId: 'project_status',
        projectId: 'proj-1',
      });

      const report = await reportService.getById(created.id);
      expect(report.templateId).toBe('project_status');
    });

    it('should return null for non-existent report', async () => {
      const report = await reportService.getById('non-existent');
      expect(report).toBeNull();
    });
  });

  describe('Report Listing', () => {
    it('should list reports by project', async () => {
      await reportService.generate({ templateId: 'executive_summary', projectId: 'proj-1' });
      await reportService.generate({ templateId: 'project_status', projectId: 'proj-1' });
      await reportService.generate({ templateId: 'financial', projectId: 'proj-2' });

      const proj1Reports = await reportService.listByProject('proj-1');

      expect(proj1Reports).toHaveLength(2);
      expect(proj1Reports.every((r) => r.projectId === 'proj-1')).toBe(true);
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await reportService.generate({
          templateId: 'executive_summary',
          projectId: 'proj-1',
        });
      }

      const page1 = await reportService.listByProject('proj-1', { limit: 2, offset: 0 });
      const page2 = await reportService.listByProject('proj-1', { limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });
  });

  describe('Templates', () => {
    it('should list available templates', async () => {
      const templates = await reportService.getTemplates();

      expect(templates).toHaveLength(3);
      expect(templates.map((t) => t.id)).toContain('executive_summary');
    });
  });

  describe('Scheduling', () => {
    it('should schedule recurring report', async () => {
      const schedule = await reportService.schedule({
        templateId: 'project_status',
        projectId: 'proj-1',
        frequency: 'weekly',
        recipients: ['user-1@test.com', 'user-2@test.com'],
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.frequency).toBe('weekly');
      expect(schedule.recipients).toHaveLength(2);
      expect(schedule.active).toBe(true);
    });
  });

  describe('Export', () => {
    it('should export completed report', async () => {
      const report = await reportService.generate({
        templateId: 'executive_summary',
        projectId: 'proj-1',
      });

      // Wait for generation
      await new Promise((r) => setTimeout(r, 20));

      const exported = await reportService.export(report.id, 'xlsx');

      expect(exported.format).toBe('xlsx');
      expect(exported.fileUrl).toContain('.xlsx');
    });
  });

  describe('Delete', () => {
    it('should delete report', async () => {
      const report = await reportService.generate({
        templateId: 'executive_summary',
        projectId: 'proj-1',
      });

      await reportService.delete(report.id);

      const deleted = await reportService.getById(report.id);
      expect(deleted).toBeNull();
    });
  });
});
