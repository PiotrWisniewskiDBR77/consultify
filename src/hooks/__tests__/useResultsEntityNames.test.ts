import { describe, expect, it } from 'vitest';

import {
  buildResultsEntityNameMap,
  resultsEntityNameOrUnknown,
} from '../useResultsEntityNames';

describe('results entity name resolver', () => {
  it('maps objective, set, program and organization identifiers to business names', () => {
    expect(
      buildResultsEntityNameMap([
        { objective_id: 'objective-1', title: 'Wzrost marży' },
        { setId: 'set-1', title: 'Cele zarządu' },
        { programId: 'program-1', name: 'Transformacja 2026' },
        { id: 'org-1', name: 'DBR77' },
      ])
    ).toEqual({
      'objective-1': 'Wzrost marży',
      'set-1': 'Cele zarządu',
      'program-1': 'Transformacja 2026',
      'org-1': 'DBR77',
    });
  });

  it('returns a localized business fallback and never a raw UUID', () => {
    const uuid = 'a3e05d4a-08c5-47cf-9bf7-4ba50311d5a2';
    expect(resultsEntityNameOrUnknown(() => null, uuid, true, 'scope')).toBe('Nieznany cel');
    expect(resultsEntityNameOrUnknown(() => null, uuid, true, 'program')).toBe('Nieznany program');
    expect(resultsEntityNameOrUnknown(() => null, uuid, false, 'indicator')).toBe(
      'Unknown indicator'
    );
  });
});
