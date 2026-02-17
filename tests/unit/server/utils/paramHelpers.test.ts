import { describe, expect, it } from 'vitest';

import {
  getRequiredStringParam,
  getStringParam,
} from '../../../../server/src/utils/paramHelpers.js';

describe('server utils/paramHelpers', () => {
  it('getStringParam handles undefined, string and string[]', () => {
    expect(getStringParam(undefined)).toBeUndefined();
    expect(getStringParam('abc')).toBe('abc');
    expect(getStringParam(['first', 'second'])).toBe('first');
  });

  it('getRequiredStringParam throws for missing/empty', () => {
    expect(() => getRequiredStringParam(undefined, 'projectId')).toThrow(
      'Missing required parameter'
    );
    expect(() => getRequiredStringParam('', 'projectId')).toThrow('Missing required parameter');
  });

  it('getRequiredStringParam returns a non-empty string', () => {
    expect(getRequiredStringParam('p1', 'projectId')).toBe('p1');
  });
});
