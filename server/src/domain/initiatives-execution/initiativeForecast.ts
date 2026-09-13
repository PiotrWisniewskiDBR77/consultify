import { z } from 'zod';

import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  MaterialCommandRuleError,
  MaterialCommandValidationError,
  type MaterialCommandEnvelope,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
} from './materialCommand.js';

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export const InitiativeForecastPayloadSchema = z
  .object({
    forecastStartDate: z.string().date().nullable().optional(),
    forecastEndDate: z.string().date().nullable().optional(),
    reason: z.string().trim().min(1).max(4000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.forecastStartDate === undefined && value.forecastEndDate === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one forecast field is required',
      });
    }
  });

export type InitiativeForecastPayload = z.infer<typeof InitiativeForecastPayloadSchema>;

export type InitiativeForecastDates = {
  forecastStartDate: string | null;
  forecastEndDate: string | null;
};

export type InitiativeForecastProjectionWrite = {
  before: InitiativeForecastDates;
  after: InitiativeForecastDates;
  receiptId: string;
  observedAt: string;
};

export type InitiativeForecastResponse = InitiativeForecastProjectionWrite & {
  initiativeId: string;
  changedFields: Array<'forecastStartDate' | 'forecastEndDate'>;
};

export interface InitiativeForecastTransaction extends MaterialCommandTransaction {
  writeInitiativeForecastProjection(input: {
    organizationId: string;
    initiativeId: string;
    actorId: string;
    clientRequestId: string;
    reason: string;
    canonicalBefore?: InitiativeForecastDates;
    canonicalFieldPresence?: {
      forecastStartDate: boolean;
      forecastEndDate: boolean;
    };
    forecastStartDate?: string | null;
    forecastEndDate?: string | null;
  }): Promise<InitiativeForecastProjectionWrite>;
}

function supportsInitiativeForecast(
  transaction: MaterialCommandTransaction
): transaction is InitiativeForecastTransaction {
  return (
    'writeInitiativeForecastProjection' in transaction &&
    typeof transaction.writeInitiativeForecastProjection === 'function'
  );
}

export class InitiativeForecastProjectionNotFoundError extends MaterialCommandRuleError {
  constructor() {
    super(
      'INITIATIVE_FORECAST_PROJECTION_NOT_FOUND',
      409,
      'Canonical Initiative has no module Initiative forecast projection'
    );
  }
}

const FORECAST_EDITABLE_LIFECYCLE_STATES = new Set(['SCHEDULED', 'IN_EXECUTION']);

export async function updateInitiativeForecast(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<InitiativeForecastPayload>
) {
  if (
    envelope.aggregateType !== 'initiative' ||
    envelope.commandType !== 'initiative.forecast.update' ||
    envelope.createIfMissing === true ||
    envelope.expectedVersion < 1
  ) {
    throw new MaterialCommandValidationError('Invalid Initiative forecast command');
  }
  const payload = InitiativeForecastPayloadSchema.parse(envelope.payload);

  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    const current = await transaction.getRelatedAggregateForUpdate<Record<string, unknown>>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!current) {
      throw new MaterialCommandValidationError('Canonical Initiative not found');
    }
    if (current.version !== envelope.expectedVersion) {
      throw new MaterialCommandConflictError(
        'aggregate version conflict',
        envelope.expectedVersion,
        current.version
      );
    }
    const lifecycleState =
      typeof current.payload.lifecycleState === 'string'
        ? current.payload.lifecycleState
        : typeof current.payload.status === 'string'
          ? current.payload.status
          : '';
    if (!FORECAST_EDITABLE_LIFECYCLE_STATES.has(lifecycleState.toUpperCase())) {
      throw new MaterialCommandRuleError(
        'INITIATIVE_FORECAST_LIFECYCLE_INVALID',
        409,
        'Initiative forecast can be changed only after scheduling and before delivery'
      );
    }
    if (!supportsInitiativeForecast(transaction)) {
      throw new MaterialCommandValidationError(
        'Initiative forecast projection writer is not configured'
      );
    }

    const canonicalDate = (field: 'forecastStartDate' | 'forecastEndDate'): string | null => {
      const value = current.payload[field];
      if (value == null) return null;
      const parsed = z.string().date().safeParse(value);
      if (!parsed.success) {
        throw new MaterialCommandRuleError(
          'INITIATIVE_FORECAST_CURRENT_INVALID',
          409,
          'Current canonical Initiative forecast contains an invalid date'
        );
      }
      return parsed.data;
    };

    const projection = await transaction.writeInitiativeForecastProjection({
      organizationId: envelope.organizationId,
      initiativeId: envelope.aggregateId,
      actorId: envelope.actorId,
      clientRequestId: envelope.clientRequestId,
      reason: payload.reason,
      canonicalBefore: {
        forecastStartDate: canonicalDate('forecastStartDate'),
        forecastEndDate: canonicalDate('forecastEndDate'),
      },
      canonicalFieldPresence: {
        forecastStartDate: hasOwn(current.payload, 'forecastStartDate'),
        forecastEndDate: hasOwn(current.payload, 'forecastEndDate'),
      },
      ...(hasOwn(payload, 'forecastStartDate')
        ? { forecastStartDate: payload.forecastStartDate }
        : {}),
      ...(hasOwn(payload, 'forecastEndDate') ? { forecastEndDate: payload.forecastEndDate } : {}),
    });
    if (
      projection.after.forecastStartDate !== null &&
      projection.after.forecastEndDate !== null &&
      projection.after.forecastStartDate > projection.after.forecastEndDate
    ) {
      throw new MaterialCommandRuleError(
        'INITIATIVE_FORECAST_RANGE_INVALID',
        409,
        'Initiative forecast end date cannot be before its start date'
      );
    }
    const mutation = {
      ...current.payload,
      ...(hasOwn(payload, 'forecastStartDate')
        ? { forecastStartDate: projection.after.forecastStartDate }
        : {}),
      ...(hasOwn(payload, 'forecastEndDate')
        ? { forecastEndDate: projection.after.forecastEndDate }
        : {}),
    };
    const response: InitiativeForecastResponse = {
      initiativeId: envelope.aggregateId,
      ...projection,
      changedFields: [
        ...(hasOwn(payload, 'forecastStartDate') ? (['forecastStartDate'] as const) : []),
        ...(hasOwn(payload, 'forecastEndDate') ? (['forecastEndDate'] as const) : []),
      ],
    };

    return {
      mutation,
      response,
      eventType: 'execution.plan.changed',
      eventPayload: response,
      auditPayload: {
        reason: payload.reason,
        before: projection.before,
        after: projection.after,
        receiptId: projection.receiptId,
        observedAt: projection.observedAt,
      },
    };
  });
}
