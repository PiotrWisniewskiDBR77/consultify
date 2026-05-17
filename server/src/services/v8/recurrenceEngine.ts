/**
 * P02 §2.3.12 — Recurrence Engine
 *
 * RRULE parser + window-only materialization.
 * Uses the `rrule` npm package for RFC 5545 RRULE expansion.
 * Exceptions from RecurrenceModel.exceptions[] override/cancel specific instances.
 */

import RRulePackage from 'rrule';
import type { RRule } from 'rrule';

import logger from '../../utils/Logger.js';
import type { RecurrenceModel } from './calendarInteropService.js';

const LOG_PREFIX = '[P02-RecurrenceEngine]';
const { rrulestr } = (RRulePackage as any).default || (RRulePackage as any);

export interface MaterializedInstance {
  startAt: string;
  endAt: string | null;
  recurrenceId: string;
  isException: boolean;
  isCancelled: boolean;
  overrides?: Record<string, unknown>;
}

/**
 * Materialize recurrence instances within a time window.
 * Returns only the instances that fall within [windowStart, windowEnd].
 * Exceptions (modified/cancelled) are overlaid on top of generated instances.
 */
export function materializeInstances(
  seriesStartAt: string,
  seriesEndAt: string | null,
  recurrence: RecurrenceModel,
  windowStart: string,
  windowEnd: string
): MaterializedInstance[] {
  const wStart = new Date(windowStart);
  const wEnd = new Date(windowEnd);
  const eventStart = new Date(seriesStartAt);
  const durationMs = seriesEndAt ? new Date(seriesEndAt).getTime() - eventStart.getTime() : 0;

  if (!recurrence.rrule) {
    return [
      {
        startAt: seriesStartAt,
        endAt: seriesEndAt,
        recurrenceId: seriesStartAt,
        isException: false,
        isCancelled: false,
      },
    ];
  }

  try {
    const rule = rrulestr(`DTSTART:${formatRRuleDate(eventStart)}\nRRULE:${recurrence.rrule}`, {
      forceset: false,
    });
    const generatedOccurrences = (rule as RRule).between(wStart, wEnd, true);

    // Keep recurrence expansion compatible with older/newer `rrule` builds that may
    // not export RRuleSet in ESM. We merge explicit RDATE/EXDATE manually.
    const exdateSet = new Set((recurrence.exdate ?? []).map((value) => new Date(value).toISOString()));
    const occurrenceMap = new Map<string, Date>();

    for (const occ of generatedOccurrences) {
      const iso = occ.toISOString();
      if (!exdateSet.has(iso)) {
        occurrenceMap.set(iso, occ);
      }
    }
    for (const rdate of recurrence.rdate ?? []) {
      const date = new Date(rdate);
      if (date >= wStart && date <= wEnd) {
        const iso = date.toISOString();
        if (!exdateSet.has(iso)) {
          occurrenceMap.set(iso, date);
        }
      }
    }
    const occurrences = [...occurrenceMap.values()].sort((a, b) => a.getTime() - b.getTime());

    const exceptionMap = new Map<string, RecurrenceModel['exceptions'][number]>();
    for (const exc of recurrence.exceptions) {
      exceptionMap.set(exc.recurrenceId, exc);
    }

    const instances: MaterializedInstance[] = [];

    for (const occ of occurrences) {
      const occISO = occ.toISOString();
      const exception = exceptionMap.get(occISO);

      if (exception) {
        instances.push({
          startAt: occISO,
          endAt: durationMs ? new Date(occ.getTime() + durationMs).toISOString() : null,
          recurrenceId: occISO,
          isException: true,
          isCancelled: exception.action === 'cancelled',
          overrides: exception.overrides,
        });
        exceptionMap.delete(occISO);
      } else {
        instances.push({
          startAt: occISO,
          endAt: durationMs ? new Date(occ.getTime() + durationMs).toISOString() : null,
          recurrenceId: occISO,
          isException: false,
          isCancelled: false,
        });
      }
    }

    for (const [recId, exc] of exceptionMap.entries()) {
      const excDate = new Date(recId);
      if (excDate >= wStart && excDate <= wEnd) {
        instances.push({
          startAt: recId,
          endAt: durationMs ? new Date(excDate.getTime() + durationMs).toISOString() : null,
          recurrenceId: recId,
          isException: true,
          isCancelled: exc.action === 'cancelled',
          overrides: exc.overrides,
        });
      }
    }

    return instances;
  } catch (err) {
    logger.error(`${LOG_PREFIX} Failed to materialize recurrence: ${(err as Error).message}`);
    return [
      {
        startAt: seriesStartAt,
        endAt: seriesEndAt,
        recurrenceId: seriesStartAt,
        isException: false,
        isCancelled: false,
      },
    ];
  }
}

function formatRRuleDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Parse an RRULE string into an RRule object for inspection.
 * Returns null if the RRULE is invalid.
 */
export function parseRRule(rruleString: string): RRule | null {
  try {
    return rrulestr(`RRULE:${rruleString}`) as RRule;
  } catch {
    logger.warn(`${LOG_PREFIX} Invalid RRULE: ${rruleString}`);
    return null;
  }
}

/**
 * Validate that a RecurrenceModel is structurally sound.
 */
export function validateRecurrenceModel(model: RecurrenceModel): string[] {
  const errors: string[] = [];

  if (!model.seriesMasterRef) {
    errors.push('seriesMasterRef is required');
  }
  if (model.materializationRule !== 'window_only') {
    errors.push('materializationRule must be "window_only"');
  }
  if (model.rrule && !parseRRule(model.rrule)) {
    errors.push(`Invalid RRULE: ${model.rrule}`);
  }
  for (const exc of model.exceptions) {
    if (!exc.recurrenceId) {
      errors.push('Exception missing recurrenceId');
    }
    if (!['modified', 'cancelled'].includes(exc.action)) {
      errors.push(`Exception has invalid action: ${exc.action}`);
    }
  }

  return errors;
}
