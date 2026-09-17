/**
 * @vitest-environment node
 *
 * OP-1/W139: public method-session creation must assign a human-readable name
 * when clients omit it (Library → Start, API callers, seeds), while explicit
 * names still win and keep the 160-character guard.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../method-core.routes.ts', import.meta.url), 'utf8');

describe('method-core route — session default naming contract', () => {
  it('builds a DRD/org/date default name when request body has no name', () => {
    expect(source).toContain('function methodSessionDefaultName');
    expect(source).toContain("input.methodPackId === DRD_METHOD_PACK_ID ? 'DRD' : input.methodPackId");
    expect(source).toContain('organizationName || input.organizationId.slice(0, 8)');
    expect(source).toContain('requestedName ||');
    expect(source).toContain('name: sessionName');
  });

  it('keeps the explicit name length guard on requestedName', () => {
    expect(source).toContain('if (requestedName.length > 160)');
    expect(source).toContain('METHOD_SESSION_NAME_TOO_LONG');
  });
});
