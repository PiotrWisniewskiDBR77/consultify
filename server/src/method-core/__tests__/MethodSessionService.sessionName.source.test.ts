/**
 * @vitest-environment node
 *
 * OP-1/W139: every method session create/reopen path must persist a visible
 * name. This source-level contract protects the two regressions found in OP-1:
 * createSession accepted null names, and frozen→active reopen copied a name in
 * memory but omitted the `name` column from the INSERT.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../MethodSessionService.ts', import.meta.url), 'utf8');

describe('MethodSessionService — session name persistence contract', () => {
  it('normalizes createSession names before inserting method_sessions', () => {
    expect(source).toContain('function normalizeMethodSessionName');
    expect(source).toContain('name: normalizeMethodSessionName({');
    expect(source).toContain('defaultMethodSessionName(input)');
  });

  it('persists name on frozen-to-active reopen INSERT', () => {
    const reopen = source.slice(source.indexOf("if (from === 'frozen' && to === 'active')"));
    expect(reopen).toContain('name: session.name');
    expect(reopen).toContain('(id, name, organization_id');
    expect(reopen).toContain('revision.name');
  });
});
