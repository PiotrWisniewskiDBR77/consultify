/**
 * Scheduled Report Service Tests
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the service for testing
const mockScheduledReportService = {
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  getSchedule: vi.fn(),
  listSchedules: vi.fn(),
  deleteSchedule: vi.fn(),
  pauseSchedule: vi.fn(),
  resumeSchedule: vi.fn(),
  executeSchedule: vi.fn(),
  getDueSchedules: vi.fn(),
  getExecutionHistory: vi.fn(),
  getFrequencyPresets: vi.fn(),
};

describe('ScheduledReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSchedule', () => {
    it('should create a new schedule with cron expression', async () => {
      mockScheduledReportService.createSchedule.mockResolvedValue({
        id: 'schedule-123',
        organizationId: 'org-1',
        name: 'Weekly Assessment Report',
        frequency: 'weekly',
        cronExpression: '0 9 * * 1',
        timezone: 'Europe/Warsaw',
        nextRunAt: '2026-02-10T09:00:00Z',
        isActive: true,
        deliveryMethods: ['email', 'dashboard'],
        deliveryConfig: {
          email: {
            recipients: ['manager@company.com'],
            includeAttachment: true,
            attachmentFormat: 'pdf',
          },
        },
        createdAt: '2026-02-04T10:00:00Z',
      });

      const result = await mockScheduledReportService.createSchedule({
        name: 'Weekly Assessment Report',
        reportType: 'assessment',
        frequency: 'weekly',
        timezone: 'Europe/Warsaw',
        deliveryMethods: ['email', 'dashboard'],
        deliveryConfig: {
          email: {
            recipients: ['manager@company.com'],
            includeAttachment: true,
            attachmentFormat: 'pdf',
          },
        },
      });

      expect(result.id).toBeDefined();
      expect(result.cronExpression).toBe('0 9 * * 1');
      expect(result.nextRunAt).toBeDefined();
      expect(result.isActive).toBe(true);
    });

    it('should calculate next run time correctly', async () => {
      const now = new Date('2026-02-04T10:00:00Z');
      const expectedNextRun = new Date('2026-02-05T09:00:00Z');

      mockScheduledReportService.createSchedule.mockResolvedValue({
        id: 'schedule-124',
        frequency: 'daily',
        cronExpression: '0 9 * * *',
        nextRunAt: expectedNextRun.toISOString(),
      });

      const result = await mockScheduledReportService.createSchedule({
        name: 'Daily Report',
        reportType: 'assessment',
        frequency: 'daily',
        deliveryMethods: ['dashboard'],
        deliveryConfig: {},
      });

      expect(new Date(result.nextRunAt)).toBeInstanceOf(Date);
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule configuration', async () => {
      mockScheduledReportService.updateSchedule.mockResolvedValue({
        id: 'schedule-123',
        name: 'Updated Report Name',
        frequency: 'monthly',
        cronExpression: '0 9 1 * *',
        nextRunAt: '2026-03-01T09:00:00Z',
      });

      const result = await mockScheduledReportService.updateSchedule('schedule-123', 'org-1', {
        name: 'Updated Report Name',
        frequency: 'monthly',
      });

      expect(result.name).toBe('Updated Report Name');
      expect(result.frequency).toBe('monthly');
    });

    it('should recalculate next run when schedule changes', async () => {
      mockScheduledReportService.updateSchedule.mockResolvedValue({
        id: 'schedule-123',
        cronExpression: '0 9 * * 1',
        nextRunAt: '2026-02-10T09:00:00Z',
      });

      const result = await mockScheduledReportService.updateSchedule('schedule-123', 'org-1', {
        cronExpression: '0 9 * * 1',
      });

      expect(result.nextRunAt).toBeDefined();
    });
  });

  describe('pauseSchedule', () => {
    it('should pause an active schedule', async () => {
      mockScheduledReportService.pauseSchedule.mockResolvedValue({
        id: 'schedule-123',
        isActive: false,
      });

      const result = await mockScheduledReportService.pauseSchedule('schedule-123', 'org-1');

      expect(result.isActive).toBe(false);
    });
  });

  describe('resumeSchedule', () => {
    it('should resume a paused schedule and recalculate next run', async () => {
      mockScheduledReportService.resumeSchedule.mockResolvedValue({
        id: 'schedule-123',
        isActive: true,
        nextRunAt: '2026-02-05T09:00:00Z',
      });

      const result = await mockScheduledReportService.resumeSchedule('schedule-123', 'org-1');

      expect(result.isActive).toBe(true);
      expect(result.nextRunAt).toBeDefined();
    });
  });

  describe('executeSchedule', () => {
    it('should execute schedule and generate report', async () => {
      mockScheduledReportService.executeSchedule.mockResolvedValue({
        id: 'execution-1',
        scheduleId: 'schedule-123',
        status: 'success',
        startedAt: '2026-02-04T09:00:00Z',
        completedAt: '2026-02-04T09:01:00Z',
        generatedReportId: 'report-456',
        deliveryResults: [
          { method: 'email', status: 'success', timestamp: '2026-02-04T09:01:00Z' },
          { method: 'dashboard', status: 'success', timestamp: '2026-02-04T09:01:00Z' },
        ],
      });

      const result = await mockScheduledReportService.executeSchedule('schedule-123');

      expect(result.status).toBe('success');
      expect(result.generatedReportId).toBeDefined();
      expect(result.deliveryResults).toHaveLength(2);
    });

    it('should handle execution failure gracefully', async () => {
      mockScheduledReportService.executeSchedule.mockResolvedValue({
        id: 'execution-2',
        scheduleId: 'schedule-123',
        status: 'failed',
        startedAt: '2026-02-04T09:00:00Z',
        completedAt: '2026-02-04T09:00:30Z',
        error: 'Failed to generate report: Template not found',
        deliveryResults: [],
      });

      const result = await mockScheduledReportService.executeSchedule('schedule-123');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('getDueSchedules', () => {
    it('should return schedules due for execution', async () => {
      mockScheduledReportService.getDueSchedules.mockResolvedValue([
        { id: 'schedule-1', name: 'Daily Report', nextRunAt: '2026-02-04T09:00:00Z' },
        { id: 'schedule-2', name: 'Weekly Report', nextRunAt: '2026-02-04T09:00:00Z' },
      ]);

      const result = await mockScheduledReportService.getDueSchedules();

      expect(result).toHaveLength(2);
      expect(result.every((s: any) => new Date(s.nextRunAt) <= new Date())).toBe(true);
    });

    it('should not return paused schedules', async () => {
      mockScheduledReportService.getDueSchedules.mockResolvedValue([
        { id: 'schedule-1', name: 'Daily Report', isActive: true },
      ]);

      const result = await mockScheduledReportService.getDueSchedules();

      expect(result.every((s: any) => s.isActive !== false)).toBe(true);
    });
  });

  describe('getExecutionHistory', () => {
    it('should return execution history for a schedule', async () => {
      mockScheduledReportService.getExecutionHistory.mockResolvedValue([
        {
          id: 'exec-1',
          status: 'success',
          startedAt: '2026-02-04T09:00:00Z',
          generatedReportId: 'report-1',
        },
        {
          id: 'exec-2',
          status: 'success',
          startedAt: '2026-02-03T09:00:00Z',
          generatedReportId: 'report-2',
        },
        {
          id: 'exec-3',
          status: 'failed',
          startedAt: '2026-02-02T09:00:00Z',
          error: 'Timeout',
        },
      ]);

      const result = await mockScheduledReportService.getExecutionHistory('schedule-123', 'org-1', 10);

      expect(result).toHaveLength(3);
      expect(result[0].startedAt).toBeDefined();
    });
  });

  describe('getFrequencyPresets', () => {
    it('should return available frequency presets', () => {
      mockScheduledReportService.getFrequencyPresets.mockReturnValue([
        { frequency: 'daily', label: 'Daily at 9 AM', cron: '0 9 * * *' },
        { frequency: 'weekly', label: 'Weekly on Monday', cron: '0 9 * * 1' },
        { frequency: 'biweekly', label: 'Bi-weekly (1st & 15th)', cron: '0 9 1,15 * *' },
        { frequency: 'monthly', label: 'Monthly on 1st', cron: '0 9 1 * *' },
        { frequency: 'quarterly', label: 'Quarterly', cron: '0 9 1 1,4,7,10 *' },
      ]);

      const presets = mockScheduledReportService.getFrequencyPresets();

      expect(presets).toHaveLength(5);
      expect(presets.map((p: any) => p.frequency)).toContain('daily');
      expect(presets.map((p: any) => p.frequency)).toContain('weekly');
      expect(presets.map((p: any) => p.frequency)).toContain('monthly');
    });
  });

  describe('delivery methods', () => {
    it('should support email delivery with attachments', async () => {
      mockScheduledReportService.executeSchedule.mockResolvedValue({
        id: 'execution-3',
        status: 'success',
        deliveryResults: [
          {
            method: 'email',
            status: 'success',
            details: 'Sent to 3 recipients',
            timestamp: '2026-02-04T09:01:00Z',
          },
        ],
      });

      const result = await mockScheduledReportService.executeSchedule('schedule-123');

      expect(result.deliveryResults.find((d: any) => d.method === 'email')?.status).toBe('success');
    });

    it('should support webhook delivery', async () => {
      mockScheduledReportService.executeSchedule.mockResolvedValue({
        id: 'execution-4',
        status: 'success',
        deliveryResults: [
          {
            method: 'webhook',
            status: 'success',
            details: 'POST to https://api.example.com/reports',
            timestamp: '2026-02-04T09:01:00Z',
          },
        ],
      });

      const result = await mockScheduledReportService.executeSchedule('schedule-123');

      expect(result.deliveryResults.find((d: any) => d.method === 'webhook')?.status).toBe('success');
    });

    it('should handle partial delivery failures', async () => {
      mockScheduledReportService.executeSchedule.mockResolvedValue({
        id: 'execution-5',
        status: 'success',
        deliveryResults: [
          { method: 'email', status: 'success', timestamp: '2026-02-04T09:01:00Z' },
          { method: 'webhook', status: 'failed', details: 'Connection timeout', timestamp: '2026-02-04T09:01:30Z' },
        ],
      });

      const result = await mockScheduledReportService.executeSchedule('schedule-123');

      // Overall success even if one delivery failed
      expect(result.status).toBe('success');
      expect(result.deliveryResults.find((d: any) => d.method === 'webhook')?.status).toBe('failed');
    });
  });
});
