/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  InitiativeForecastProjectionNotFoundError,
  type InitiativeForecastTransaction,
  updateInitiativeForecast,
} from '../initiativeForecast.js';
import { materialCommandFingerprint } from '../materialCommand.js';
import { PostgresMaterialCommandUnitOfWork } from '../postgresMaterialCommandUnitOfWork.js';

const initiativeId = 'initiative-forecast-review';
const organizationId = 'org-forecast-review';

const canonical = (lifecycleState = 'IN_EXECUTION') => ({
  initiativeId,
  lifecycleState,
  title: 'Preserved title',
  projectId: 'project-forecast-review',
  initiativeOwnerId: 'actor-forecast-review',
  governance: { policyId: 'policy-review', policyVersion: 7 },
  cardRefs: { summary: { version: 3 } },
});

const envelope = (payload: Record<string, unknown>, expectedVersion = 4) => ({
  organizationId,
  actorId: 'actor-forecast-review',
  aggregateType: 'initiative',
  aggregateId: initiativeId,
  expectedVersion,
  clientRequestId: 'request-forecast-review',
  correlationId: 'correlation-forecast-review',
  policyId: 'policy-review',
  policyVersion: 7,
  commandType: 'initiative.forecast.update',
  payload,
});

function commandHarness(args?: {
  lifecycleState?: string;
  projection?: {
    before: { forecastStartDate: string | null; forecastEndDate: string | null };
    after: { forecastStartDate: string | null; forecastEndDate: string | null };
    receiptId: string;
    observedAt: string;
  };
}) {
  const payload = canonical(args?.lifecycleState);
  const transaction = {
    findReceipt: vi.fn().mockResolvedValue(null),
    getAggregatePayload: vi.fn().mockResolvedValue(payload),
    getAggregateVersion: vi.fn().mockResolvedValue(4),
    getRelatedAggregateForUpdate: vi.fn().mockResolvedValue({ version: 4, payload }),
    writeInitiativeForecastProjection: vi.fn().mockResolvedValue(
      args?.projection ?? {
        before: { forecastStartDate: '2026-09-10', forecastEndDate: '2026-09-30' },
        after: { forecastStartDate: '2026-09-10', forecastEndDate: '2026-10-15' },
        receiptId: 'history-forecast-review',
        observedAt: '2026-09-13T12:00:00.000Z',
      }
    ),
    persistAggregate: vi.fn().mockResolvedValue(undefined),
    appendAudit: vi.fn().mockResolvedValue(undefined),
    appendOutbox: vi.fn().mockResolvedValue(undefined),
    saveReceipt: vi.fn().mockResolvedValue(undefined),
  };
  return {
    transaction,
    unitOfWork: {
      transaction: vi.fn(async (work: (tx: typeof transaction) => Promise<unknown>) =>
        work(transaction)
      ),
    },
  };
}

describe('Initiative forecast canonical command — independent adversarial contract', () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTimezone;
  });

  it('preserves the complete canonical payload and uses one Initiative identity/version for an end-only write', async () => {
    const { transaction, unitOfWork } = commandHarness();

    const result = await updateInitiativeForecast(
      unitOfWork as any,
      envelope({ forecastEndDate: '2026-10-15', reason: 'Supplier delivery moved' }) as any
    );

    expect(result).toMatchObject({
      status: 'APPLIED',
      aggregateVersion: 5,
      response: {
        initiativeId,
        receiptId: 'history-forecast-review',
        after: { forecastStartDate: '2026-09-10', forecastEndDate: '2026-10-15' },
      },
    });
    expect(transaction.writeInitiativeForecastProjection).toHaveBeenCalledWith({
      organizationId,
      initiativeId,
      actorId: 'actor-forecast-review',
      clientRequestId: 'request-forecast-review',
      reason: 'Supplier delivery moved',
      forecastEndDate: '2026-10-15',
    });
    expect(transaction.persistAggregate).toHaveBeenCalledWith(
      organizationId,
      'initiative',
      initiativeId,
      4,
      5,
      expect.objectContaining({
        title: 'Preserved title',
        governance: { policyId: 'policy-review', policyVersion: 7 },
        cardRefs: { summary: { version: 3 } },
        forecastStartDate: '2026-09-10',
        forecastEndDate: '2026-10-15',
      })
    );
    expect(transaction.appendOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'initiative',
        aggregateId: initiativeId,
        aggregateVersion: 5,
        eventType: 'execution.plan.changed',
      })
    );
  });

  it('replays the exact request before projection and conflicts on request-ID reuse with changed input', async () => {
    const exactEnvelope = envelope({
      forecastEndDate: '2026-10-15',
      reason: 'Supplier delivery moved',
    }) as any;
    const storedResponse = {
      initiativeId,
      before: { forecastStartDate: '2026-09-10', forecastEndDate: '2026-09-30' },
      after: { forecastStartDate: '2026-09-10', forecastEndDate: '2026-10-15' },
      receiptId: 'history-stored-review',
      observedAt: '2026-09-13T12:00:00.000Z',
    };
    const { transaction, unitOfWork } = commandHarness();
    transaction.findReceipt.mockResolvedValue({
      organizationId,
      clientRequestId: exactEnvelope.clientRequestId,
      commandType: exactEnvelope.commandType,
      aggregateType: exactEnvelope.aggregateType,
      aggregateId: exactEnvelope.aggregateId,
      aggregateVersion: 5,
      correlationId: exactEnvelope.correlationId,
      requestFingerprint: materialCommandFingerprint(exactEnvelope),
      response: storedResponse,
    });

    await expect(updateInitiativeForecast(unitOfWork as any, exactEnvelope)).resolves.toMatchObject({
      status: 'REPLAYED',
      aggregateVersion: 5,
      response: storedResponse,
    });
    expect(transaction.getAggregateVersion).not.toHaveBeenCalled();
    expect(transaction.writeInitiativeForecastProjection).not.toHaveBeenCalled();
    expect(transaction.persistAggregate).not.toHaveBeenCalled();

    await expect(
      updateInitiativeForecast(
        unitOfWork as any,
        {
          ...exactEnvelope,
          payload: { forecastEndDate: '2026-11-01', reason: 'Changed reuse' },
        }
      )
    ).rejects.toMatchObject({ expectedVersion: 4, currentVersion: 5 });
    expect(transaction.writeInitiativeForecastProjection).not.toHaveBeenCalled();
  });

  it('fails closed when the same-ID module projection is absent and never invents a row', async () => {
    const { transaction, unitOfWork } = commandHarness();
    transaction.writeInitiativeForecastProjection.mockRejectedValueOnce(
      new InitiativeForecastProjectionNotFoundError()
    );

    await expect(
      updateInitiativeForecast(
        unitOfWork as any,
        envelope({ forecastStartDate: null, reason: 'Clear absent projection' }) as any
      )
    ).rejects.toMatchObject({ rule: 'INITIATIVE_FORECAST_PROJECTION_NOT_FOUND' });

    expect(transaction.persistAggregate).not.toHaveBeenCalled();
    expect(transaction.appendAudit).not.toHaveBeenCalled();
    expect(transaction.appendOutbox).not.toHaveBeenCalled();
    expect(transaction.saveReceipt).not.toHaveBeenCalled();
  });

  it('rejects malformed dates and extra command fields before opening a transaction', async () => {
    const { unitOfWork } = commandHarness();

    await expect(
      updateInitiativeForecast(
        unitOfWork as any,
        envelope({
          forecastStartDate: '2026-02-30',
          reason: 'Impossible calendar date',
          baselineEndDate: '2026-10-01',
        }) as any
      )
    ).rejects.toBeTruthy();

    expect(unitOfWork.transaction).not.toHaveBeenCalled();
  });

  it('refuses to rewrite forecast on a CLOSED Initiative without the required reopen Decision', async () => {
    const { transaction, unitOfWork } = commandHarness({ lifecycleState: 'CLOSED' });

    await expect(
      updateInitiativeForecast(
        unitOfWork as any,
        envelope({ forecastEndDate: '2026-10-15', reason: 'Attempt after closure' }) as any
      )
    ).rejects.toMatchObject({ rule: 'INITIATIVE_FORECAST_LIFECYCLE_INVALID' });

    expect(transaction.writeInitiativeForecastProjection).not.toHaveBeenCalled();
    expect(transaction.persistAggregate).not.toHaveBeenCalled();
  });

  it('rejects a partial write whose merged forecast interval ends before it starts', async () => {
    const { transaction, unitOfWork } = commandHarness({
      projection: {
        before: { forecastStartDate: '2026-10-10', forecastEndDate: '2026-10-30' },
        after: { forecastStartDate: '2026-10-10', forecastEndDate: '2026-10-01' },
        receiptId: 'history-invalid-range',
        observedAt: '2026-09-13T12:00:00.000Z',
      },
    });

    await expect(
      updateInitiativeForecast(
        unitOfWork as any,
        envelope({ forecastEndDate: '2026-10-01', reason: 'Invalid partial interval' }) as any
      )
    ).rejects.toMatchObject({ rule: 'INITIATIVE_FORECAST_RANGE_INVALID' });

    expect(transaction.persistAggregate).not.toHaveBeenCalled();
    expect(transaction.appendAudit).not.toHaveBeenCalled();
    expect(transaction.appendOutbox).not.toHaveBeenCalled();
    expect(transaction.saveReceipt).not.toHaveBeenCalled();
  });

  it('keeps a PostgreSQL DATE calendar day stable in a positive-offset runtime', async () => {
    process.env.TZ = 'Europe/Warsaw';
    const pgDate = new Date(2026, 8, 13);
    expect(pgDate.toISOString().startsWith('2026-09-12')).toBe(true);

    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: null };
      }
      if (/SELECT forecast_start_date, forecast_end_date/.test(sql)) {
        expect(params).toEqual([organizationId, initiativeId]);
        expect(sql).toContain('organization_id=$1 AND id=$2');
        return {
          rows: [{ forecast_start_date: pgDate, forecast_end_date: pgDate }],
          rowCount: 1,
        };
      }
      if (/UPDATE initiatives/.test(sql)) {
        expect(params?.slice(0, 2)).toEqual([organizationId, initiativeId]);
        return {
          rows: [{ forecast_start_date: pgDate, forecast_end_date: pgDate }],
          rowCount: 1,
        };
      }
      if (/INSERT INTO initiative_history/.test(sql)) {
        return {
          rows: [{ id: 'history-date-review', observed_at: 1_789_300_800 }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL in adversarial harness: ${sql}`);
    });
    const client = { query, release: vi.fn() };
    const unitOfWork = new PostgresMaterialCommandUnitOfWork({
      connect: vi.fn().mockResolvedValue(client),
    } as any);

    const result = await unitOfWork.transaction((transaction) =>
      (transaction as InitiativeForecastTransaction).writeInitiativeForecastProjection({
        organizationId,
        initiativeId,
        actorId: 'actor-forecast-review',
        clientRequestId: 'request-date-review',
        reason: 'Calendar day must remain stable',
        forecastEndDate: '2026-09-13',
      })
    );

    expect(result.before).toEqual({
      forecastStartDate: '2026-09-13',
      forecastEndDate: '2026-09-13',
    });
    expect(result.after).toEqual(result.before);
  });
});
