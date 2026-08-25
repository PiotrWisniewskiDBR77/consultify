import { describe, expect, it } from 'vitest';

import {
  escapeResultsTextMatch,
  resultsTextMatchPattern,
  resultsTextMatchSql,
} from '../textMatch.js';

describe('Day 14 Results text match', () => {
  it('escapes every ILIKE metacharacter before adding wildcards', () => {
    expect(escapeResultsTextMatch('50%_\\')).toBe('50\\%\\_\\\\');
    expect(resultsTextMatchPattern(' 50%_\\ ')).toBe('%50\\%\\_\\\\%');
  });

  it('only builds predicates for explicitly named columns', () => {
    expect(resultsTextMatchSql(['r.title', 'r.code'], '$4')).toBe(
      "(r.title ILIKE $4 ESCAPE E'\\\\' OR r.code ILIKE $4 ESCAPE E'\\\\')"
    );
  });
});
