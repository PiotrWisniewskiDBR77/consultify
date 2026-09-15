import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuditLog, db } = vi.hoisted(() => ({
  getAuditLog: vi.fn(),
  db: {
    get: vi.fn((_sql: string, _params: unknown[], callback: (error: null, row: null) => void) => callback(null, null)),
    run: vi.fn((_sql: string, _params: unknown[], callback: (error: null) => void) => callback(null)),
  },
}));

vi.mock('../../actionDecisionService.js', () => ({ default: { getAuditLog } }));
vi.mock('../../../database/index.js', () => ({ getDatabase: () => db }));
vi.mock('../../../utils/auditLogger.js', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../../legacyNoncanonicalExecution.js', () => ({ assertLegacyNoncanonicalExecution: vi.fn() }));

import ActionExecutionAdapter from '../../actionExecutionAdapter.js';
import { localizeServerPayload } from '../../../i18n/serverPayloadLocalizer.js';

describe('meeting executor → adapter → HTTP locale boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuditLog.mockResolvedValue([
      {
        id: 'decision-a',
        organization_id: '',
        decision: 'APPROVED',
        decided_by_user_id: 'user-a',
        proposal_snapshot: { action_type: 'MEETING_SCHEDULE', title: 'Review', start_time: '2026-09-15T10:00:00Z' },
      },
    ]);
  });

  it('returns a specific Polish HTTP 400 error and preserves status/code', async () => {
    const adapterResult = await ActionExecutionAdapter.executeDecision('decision-a', 'user-a');
    expect(adapterResult).toMatchObject({
      success: false,
      error: 'Meeting execution requires organizationId',
    });

    const response = localizeServerPayload(
      { ...adapterResult, status: 400, code: 'BAD_REQUEST' },
      { user: { language: 'pl' }, get: () => 'en-US' } as unknown as Request
    );
    expect(response).toMatchObject({
      success: false,
      error: 'Wykonanie spotkania wymaga organizationId',
      status: 400,
      code: 'BAD_REQUEST',
    });
  });
});
