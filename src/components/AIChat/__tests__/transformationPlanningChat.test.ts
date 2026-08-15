import { describe, expect, it } from 'vitest';
import {
  parsePlanningClarification,
  planningFollowUp,
  planningIntakeIdempotencyKey,
  transformationCaseReadyMessage,
} from '../transformationPlanningChat';

describe('transformation planning chat helpers', () => {
  it('parses Polish and English clarification fields without inventing absent values', () => {
    expect(parsePlanningClarification('Cel: 20% mniej czasu\nSponsor: Anna\nZakres: Polska\nHoryzont: Q4')).toEqual({
      measurableOutcomes: ['20% mniej czasu'], sponsor: 'Anna', scope: 'Polska', horizon: 'Q4',
    });
    expect(parsePlanningClarification('Sponsor: Alex')).toEqual({
      measurableOutcomes: undefined, sponsor: 'Alex', scope: undefined, horizon: undefined,
    });
  });

  it('builds stable per-conversation idempotency keys and encoded Agent links', () => {
    expect(planningIntakeIdempotencyKey('conv-1', 'same')).toBe(planningIntakeIdempotencyKey('conv-1', 'same'));
    expect(planningIntakeIdempotencyKey('conv-1', 'same')).not.toBe(planningIntakeIdempotencyKey('conv-2', 'same'));
    expect(transformationCaseReadyMessage('case/a & b', 'en')).toContain('transformationCaseId=case%2Fa+%26+b');
  });

  it('asks only for server-declared missing fields', () => {
    expect(planningFollowUp({ missingKeys: ['scope'], intakeId: 'i', status: 'needs_clarification' } as any, 'en')).toContain('scope');
    expect(planningFollowUp({ missingKeys: ['scope'], intakeId: 'i', status: 'needs_clarification' } as any, 'en')).not.toContain('sponsor,');
  });
});
