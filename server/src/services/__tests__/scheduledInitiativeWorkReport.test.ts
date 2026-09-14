/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runScheduledInitiativeWorkReport = vi.fn(async () => 'runtime-run-1');
vi.mock('../../routes/pmo/initiativesExecutionRuntime.routes.js', () => ({
  runScheduledInitiativeWorkReport,
}));

import ScheduledReportService from '../scheduledReportService.js';

describe('scheduled initiative work report bridge', () => {
  const runtimeReport = {
    definitionId: 'definition-1',
    definitionVersion: 3,
    templateId: 'DECISION_BACKLOG',
    title: 'Weekly decisions',
    projectIds: ['project-1'],
    ownerId: 'owner-1',
    approverId: 'approver-1',
    recipients: ['board@example.test'],
    cadence: 'WEEKLY' as const,
  };
  let insertedConfig: Record<string, any> | null;
  let scheduleRow: Record<string, any>;
  let service: ScheduledReportService;

  beforeEach(() => {
    insertedConfig = null;
    scheduleRow = {};
    runScheduledInitiativeWorkReport.mockClear();
    const db = {
      run: vi.fn(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO report_schedules')) {
          insertedConfig = JSON.parse(params[11]);
          scheduleRow = {
            id: params[0],
            organization_id: params[1],
            schedule_name: params[2],
            cron_expression: params[3],
            timezone: params[4],
            next_run_at: params[5],
            last_run_at: null,
            last_run_status: null,
            last_run_report_id: null,
            run_count: 0,
            is_active: 1,
            config_json: params[11],
            created_by: params[12],
            created_at: params[13],
            updated_at: params[14],
            schedule_type: params[15],
            deliverable_type: params[16],
            scope_type: params[17],
            scope_id: params[18],
            description: params[19],
          };
        }
      }),
      get: vi.fn(async () => scheduleRow),
      all: vi.fn(async () => []),
    };
    service = new ScheduledReportService();
    service.setDependencies({ db, reportBuilderService: { generateFromTemplate: vi.fn() } });
  });

  it('persists the runtime-v1 contract and delegates a due run to the canonical runner', async () => {
    const schedule = await service.createSchedule(
      {
        name: runtimeReport.title,
        reportType: 'initiative_work_report',
        runtimeReport,
        frequency: 'weekly',
        deliveryMethods: ['email', 'dashboard'],
        deliveryConfig: { email: { recipients: runtimeReport.recipients } },
      },
      'org-1',
      'owner-1'
    );

    expect(insertedConfig?.runtimeReport).toEqual(runtimeReport);
    const execution = await service.executeSchedule(schedule.id);
    expect(runScheduledInitiativeWorkReport).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', runtimeReport })
    );
    expect(execution).toMatchObject({ status: 'success', generatedReportId: 'runtime-run-1' });
    expect(execution.deliveryResults).toEqual([
      expect.objectContaining({ method: 'email', status: 'success' }),
      expect.objectContaining({ method: 'dashboard', status: 'success' }),
    ]);
  });
});
