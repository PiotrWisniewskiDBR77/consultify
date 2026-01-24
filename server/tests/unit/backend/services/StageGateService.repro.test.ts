import { beforeEach, describe, expect, it, vi } from 'vitest';

import StageGateService, { GATE_TYPES, setDb } from '../../../../src/services/stageGateService.js';
import { createMockDatabaseWithResults } from '../../../helpers/mockDatabase.js';

describe('StageGateService Infrastructure', () => {
  it('should expose _setDb on default export', () => {
    expect(typeof StageGateService._setDb).toBe('function');
  });

  it('should expose setDb as named export', () => {
    expect(typeof setDb).toBe('function');
  });

  it('should allow setting mock database via default export', () => {
    const mockDb = createMockDatabaseWithResults({});
    expect(() => StageGateService._setDb(mockDb)).not.toThrow();
  });

  it('should allow setting mock database via named export', () => {
    const mockDb = createMockDatabaseWithResults({});
    expect(() => setDb(mockDb)).not.toThrow();
  });

  it('should have correct GATE_TYPES', () => {
    expect(StageGateService.GATE_TYPES).toEqual(GATE_TYPES);
    expect(GATE_TYPES.READINESS_GATE).toBe('READINESS_GATE');
  });
});
