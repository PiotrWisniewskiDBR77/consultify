import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { AutomationService } from '../AutomationService.js';

describe('AutomationService', () => {
  let service: AutomationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AutomationService();
  });

  // -----------------------------------------------------------------------
  // createAutomation
  // -----------------------------------------------------------------------

  describe('createAutomation', () => {
    it('inserts automation + actions in a transaction', async () => {
      const autoRow = {
        id: 'auto-1',
        base_id: 'b-1',
        table_id: 't-1',
        name: 'On create',
        description: null,
        enabled: true,
        trigger_type: 'record_created',
        trigger_config: {},
      };
      const actionRow = {
        id: 'act-1',
        action_order: 0,
        action_type: 'update_record',
        action_config: { fieldUpdates: { status: 'New' } },
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [autoRow] }) // INSERT automation
        .mockResolvedValueOnce({ rows: [actionRow] }) // INSERT action
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.createAutomation('b-1', 't-1', {
        name: 'On create',
        triggerType: 'record_created',
        triggerConfig: {},
        actions: [
          { actionType: 'update_record', actionConfig: { fieldUpdates: { status: 'New' } } },
        ],
      });

      expect(result.id).toBe('auto-1');
      expect(result.name).toBe('On create');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].actionType).toBe('update_record');

      const beginCall = mockQuery.mock.calls[0][0];
      expect(beginCall).toBe('BEGIN');
      const commitCall = mockQuery.mock.calls[3][0];
      expect(commitCall).toBe('COMMIT');
    });

    it('rolls back on error', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('insert failed')) // INSERT automation fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(
        service.createAutomation('b-1', 't-1', {
          name: 'Fail',
          triggerType: 'record_created',
          triggerConfig: {},
          actions: [],
        })
      ).rejects.toThrow('insert failed');

      const rollbackCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0] === 'ROLLBACK'
      );
      expect(rollbackCall).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // listAutomations
  // -----------------------------------------------------------------------

  describe('listAutomations', () => {
    it('returns automations with joined actions', async () => {
      const rows = [
        {
          id: 'auto-1',
          base_id: 'b-1',
          table_id: 't-1',
          name: 'Auto 1',
          description: null,
          enabled: true,
          trigger_type: 'record_created',
          trigger_config: {},
          actions: [{ id: 'act-1', actionOrder: 0, actionType: 'update_record', actionConfig: {} }],
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.listAutomations('t-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('auto-1');
      expect(result[0].actions).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // toggleAutomation
  // -----------------------------------------------------------------------

  describe('toggleAutomation', () => {
    it('updates enabled flag to true', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.toggleAutomation('auto-1', true);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tp_automations SET enabled'),
        ['auto-1', true]
      );
    });

    it('updates enabled flag to false', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.toggleAutomation('auto-1', false);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tp_automations SET enabled'),
        ['auto-1', false]
      );
    });
  });

  // -----------------------------------------------------------------------
  // evaluateTriggers
  // -----------------------------------------------------------------------

  describe('evaluateTriggers', () => {
    it('finds matching automations and runs them', async () => {
      const autoRow = {
        id: 'auto-1',
        base_id: 'b-1',
        table_id: 't-1',
        name: 'Auto',
        enabled: true,
        trigger_type: 'record_created',
        trigger_config: {},
        actions: [
          {
            id: 'act-1',
            actionOrder: 0,
            actionType: 'update_record',
            actionConfig: { fieldUpdates: { status: 'New' } },
          },
        ],
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [autoRow] }) // SELECT automations
        .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] }) // INSERT run
        .mockResolvedValueOnce({ rows: [] }) // UPDATE record (executeAction)
        .mockResolvedValueOnce({ rows: [] }) // UPDATE run completed
        .mockResolvedValueOnce({ rows: [] }); // INSERT run_counts

      const record = { id: 'rec-1', data: { Name: 'Test' } };
      await service.evaluateTriggers('t-1', 'record_created', record);

      expect(mockQuery.mock.calls[0][1]).toEqual(['t-1', 'record_created']);
    });

    it('skips automations whose conditions do not match', async () => {
      const autoRow = {
        id: 'auto-1',
        base_id: 'b-1',
        table_id: 't-1',
        name: 'Auto',
        enabled: true,
        trigger_type: 'record_created',
        trigger_config: {
          conditions: [{ fieldId: 'status', operator: 'equals', value: 'VIP' }],
        },
        actions: [{ id: 'act-1', actionOrder: 0, actionType: 'update_record', actionConfig: {} }],
      };

      mockQuery.mockResolvedValueOnce({ rows: [autoRow] });

      const record = { id: 'rec-1', data: { status: 'Normal' } };
      await service.evaluateTriggers('t-1', 'record_created', record);

      // Only the SELECT query should have been called, no run insertion
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // evaluateConditions (tested via private method through evaluateTriggers)
  // -----------------------------------------------------------------------

  describe('evaluateConditions (via evaluateTriggers)', () => {
    const makeAutoRow = (conditions: unknown[]) => ({
      id: 'auto-1',
      base_id: 'b-1',
      table_id: 't-1',
      name: 'Auto',
      enabled: true,
      trigger_type: 'record_created',
      trigger_config: { conditions },
      actions: [],
    });

    it('equals operator matches', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [makeAutoRow([{ fieldId: 'status', operator: 'equals', value: 'Active' }])],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.evaluateTriggers('t-1', 'record_created', {
        id: 'r-1',
        data: { status: 'Active' },
      });

      // Run was inserted → condition matched
      const insertRunCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_automation_runs')
      );
      expect(insertRunCall).toBeDefined();
    });

    it('contains operator matches substring', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [makeAutoRow([{ fieldId: 'name', operator: 'contains', value: 'test' }])],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.evaluateTriggers('t-1', 'record_created', {
        id: 'r-1',
        data: { name: 'A test record' },
      });

      const insertRunCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_automation_runs')
      );
      expect(insertRunCall).toBeDefined();
    });

    it('is_empty operator matches null value', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [makeAutoRow([{ fieldId: 'notes', operator: 'is_empty' }])],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.evaluateTriggers('t-1', 'record_created', { id: 'r-1', data: { notes: null } });

      const insertRunCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_automation_runs')
      );
      expect(insertRunCall).toBeDefined();
    });

    it('gt operator matches greater value', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [makeAutoRow([{ fieldId: 'amount', operator: 'gt', value: 100 }])],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.evaluateTriggers('t-1', 'record_created', { id: 'r-1', data: { amount: 200 } });

      const insertRunCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_automation_runs')
      );
      expect(insertRunCall).toBeDefined();
    });

    it('lt operator matches lesser value', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [makeAutoRow([{ fieldId: 'score', operator: 'lt', value: 50 }])],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.evaluateTriggers('t-1', 'record_created', { id: 'r-1', data: { score: 10 } });

      const insertRunCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO tp_automation_runs')
      );
      expect(insertRunCall).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // executeAction — update_record
  // -----------------------------------------------------------------------

  describe('executeAction (via runAutomation)', () => {
    it('update_record patches JSONB', async () => {
      const autoRow = {
        id: 'auto-1',
        base_id: 'b-1',
        table_id: 't-1',
        name: 'Auto',
        enabled: true,
        trigger_type: 'record_created',
        trigger_config: {},
        actions: [
          {
            id: 'act-1',
            actionOrder: 0,
            actionType: 'update_record',
            actionConfig: { fieldUpdates: { status: 'Done' } },
          },
        ],
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [autoRow] }) // SELECT automations
        .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] }) // INSERT run
        .mockResolvedValueOnce({ rows: [] }) // UPDATE tp_records (JSONB patch)
        .mockResolvedValueOnce({ rows: [] }) // UPDATE run completed
        .mockResolvedValueOnce({ rows: [] }); // INSERT run_counts

      await service.evaluateTriggers('t-1', 'record_created', { id: 'rec-1', data: {} });

      // Wait for async runAutomation to complete
      await new Promise((r) => setTimeout(r, 50));

      const updateCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('UPDATE tp_records SET data = data ||')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![1]).toContain('rec-1');
    });

    it('send_webhook calls fetch', async () => {
      mockFetch.mockResolvedValueOnce({ status: 200, ok: true });

      const autoRow = {
        id: 'auto-1',
        base_id: 'b-1',
        table_id: 't-1',
        name: 'Auto',
        enabled: true,
        trigger_type: 'record_created',
        trigger_config: {},
        actions: [
          {
            id: 'act-1',
            actionOrder: 0,
            actionType: 'send_webhook',
            actionConfig: { url: 'https://example.com/hook', method: 'POST' },
          },
        ],
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [autoRow] }) // SELECT automations
        .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] }) // INSERT run
        .mockResolvedValueOnce({ rows: [] }) // UPDATE run completed
        .mockResolvedValueOnce({ rows: [] }); // INSERT run_counts

      await service.evaluateTriggers('t-1', 'record_created', { id: 'rec-1', data: {} });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Run accounting
  // -----------------------------------------------------------------------

  describe('run accounting', () => {
    it('increments monthly counter after successful run', async () => {
      const autoRow = {
        id: 'auto-1',
        base_id: 'b-1',
        table_id: 't-1',
        name: 'Auto',
        enabled: true,
        trigger_type: 'record_created',
        trigger_config: {},
        actions: [],
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [autoRow] }) // SELECT automations
        .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] }) // INSERT run
        .mockResolvedValueOnce({ rows: [] }) // UPDATE run completed
        .mockResolvedValueOnce({ rows: [] }); // INSERT/UPSERT run_counts

      await service.evaluateTriggers('t-1', 'record_created', { id: 'rec-1', data: {} });

      await new Promise((r) => setTimeout(r, 50));

      const countCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('tp_automation_run_counts')
      );
      expect(countCall).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // SECURITY (BUG 2 — run_script RCE)
  //
  // The old `run_script` action executed arbitrary user-supplied JavaScript via
  // `new Function(...)` on the server. Any user with table access could create
  // such an automation and it would fire on record_created/record_updated.
  // The fix disables execution (flag OFF by default) and returns a structured
  // error instead of evaluating the script.
  // -----------------------------------------------------------------------

  describe('run_script action (RCE hardening)', () => {
    it('does NOT execute arbitrary JS — returns a structured "disabled" error', async () => {
      // Sentinel that a real RCE would mutate. On the vulnerable code the
      // `new Function` body below runs and sets globalThis.__rceProof = true.
      (globalThis as any).__rceProof = false;

      const action = {
        id: 'act-1',
        actionOrder: 0,
        actionType: 'run_script',
        actionConfig: {
          script: 'globalThis.__rceProof = true; return 1;',
        },
      };
      const automation = { id: 'auto-1', table_id: 't-1', created_by: 'u-1' };

      // executeAction is private; invoke via cast (matches repo test style).
      const result = await (service as any).executeAction(
        action,
        { id: 'rec-1', data: {} },
        automation
      );

      // The script MUST NOT have executed.
      expect((globalThis as any).__rceProof).toBe(false);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/script actions are disabled/i);

      delete (globalThis as any).__rceProof;
    });

    it('still does NOT execute when the legacy enable flag is forced on without a sandbox', async () => {
      const previous = process.env.TP_AUTOMATION_RUN_SCRIPT_ENABLED;
      process.env.TP_AUTOMATION_RUN_SCRIPT_ENABLED = 'true';
      (globalThis as any).__rceProof = false;
      try {
        const result = await (service as any).executeAction(
          {
            id: 'act-flag-on',
            actionOrder: 0,
            actionType: 'run_script',
            actionConfig: { script: 'globalThis.__rceProof = true;' },
          },
          { id: 'rec-1', data: {} },
          { id: 'auto-1', table_id: 't-1', created_by: 'u-1' }
        );
        expect((globalThis as any).__rceProof).toBe(false);
        expect(result).toMatchObject({ success: false, error: 'script sandbox not configured' });
      } finally {
        if (previous === undefined) delete process.env.TP_AUTOMATION_RUN_SCRIPT_ENABLED;
        else process.env.TP_AUTOMATION_RUN_SCRIPT_ENABLED = previous;
        delete (globalThis as any).__rceProof;
      }
    });
  });

  // -----------------------------------------------------------------------
  // getRunHistory
  // -----------------------------------------------------------------------

  describe('getRunHistory', () => {
    it('returns run history rows', async () => {
      const runs = [
        { id: 'run-1', automation_id: 'auto-1', status: 'completed' },
        { id: 'run-2', automation_id: 'auto-1', status: 'failed' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: runs });

      const result = await service.getRunHistory('auto-1');
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('completed');
    });
  });

  // -----------------------------------------------------------------------
  // deleteAutomation
  // -----------------------------------------------------------------------

  describe('deleteAutomation', () => {
    it('deletes automation by id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.deleteAutomation('auto-1');

      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM tp_automations WHERE id = $1', [
        'auto-1',
      ]);
    });
  });
});
