import { describe, expect, it } from 'vitest';

import { evaluateRuntimeEvidence } from '../transformationRuntimeCapabilityService.js';

describe('Transformation runtime capability evidence contract', () => {
  const contract = {
    requiredChecks: ['adapter_registered', 'command_executable', 'readback_verified'],
  };
  const passed = (ref: string) => ({
    passed: true,
    evidenceRef: ref,
    observedAt: '2026-08-14T05:00:00.000Z',
  });

  it('never promotes an empty or evidence-free contract to REAL', () => {
    expect(evaluateRuntimeEvidence({ requiredChecks: [] }, {}).status).toBe('EVIDENCE_MISSING');
    expect(evaluateRuntimeEvidence(contract, {}).status).toBe('EVIDENCE_MISSING');
  });

  it('preserves PARTIAL when a passing check lacks provenance', () => {
    const result = evaluateRuntimeEvidence(contract, {
      adapter_registered: { passed: true, observedAt: '2026-08-14T05:00:00.000Z' },
      command_executable: passed('run:command-1'),
      readback_verified: passed('readback:artifact-1'),
    });
    expect(result.status).toBe('PARTIAL');
    expect(result.reason).toContain('adapter_registered');
  });

  it('preserves BLOCKED when any mandatory runtime check fails', () => {
    const result = evaluateRuntimeEvidence(contract, {
      adapter_registered: passed('registry:adapter-1'),
      command_executable: {
        passed: false,
        evidenceRef: 'run:failed-1',
        observedAt: '2026-08-14T05:00:00.000Z',
      },
      readback_verified: passed('readback:artifact-1'),
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toContain('command_executable');
  });

  it('derives REAL only when every required check carries provenance and time', () => {
    const evidence = {
      adapter_registered: passed('registry:adapter-1'),
      command_executable: passed('run:command-1'),
      readback_verified: passed('readback:artifact-1'),
    };
    const first = evaluateRuntimeEvidence(contract, evidence);
    const replay = evaluateRuntimeEvidence(
      { requiredChecks: [...contract.requiredChecks].reverse() },
      evidence
    );
    expect(first.status).toBe('REAL');
    expect(replay.status).toBe('REAL');
    expect(replay.digest).toBe(first.digest);
  });
});
