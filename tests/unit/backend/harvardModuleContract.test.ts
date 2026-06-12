/** @vitest-environment node */

import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { MODULES } from '../../../server/scripts/harvard-module-smoke.js';

// Static contract test (no live backend): every Harvard module's backend
// endpoint base must be mounted somewhere in the route layer. This is the CI
// guard; `npm run smoke:modules` is the runtime counterpart against a live API.

const root = process.cwd();
const sources = [
  'server/src/Gateway.ts',
  'server/src/routes/v8/index.ts',
].map((p) => fs.readFileSync(path.join(root, p), 'utf-8'));
const allSource = sources.join('\n');

function baseMount(endpoint: string): string {
  // '/api/v8/results/dashboard' → 'results' ; '/api/my-work/inbox' → 'my-work'
  const parts = endpoint.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'v8') return parts[1] || '';
  return parts[0] || '';
}

describe('Harvard module contract — every module has a mounted backend', () => {
  it('covers all 27 modules + A1 (no duplicates, ids unique)', () => {
    const ids = MODULES.map((m) => m.id);
    expect(ids.length).toBe(28);
    expect(new Set(ids).size).toBe(28);
    // M01..M27 present (M09a etc. not expected) + A1
    for (let n = 1; n <= 27; n++) {
      const id = `M${String(n).padStart(2, '0')}`;
      expect(ids).toContain(id);
    }
    expect(ids).toContain('A1');
  });

  it.each(MODULES.map((m) => [m.id, m.name, m] as const))(
    '%s %s — primary endpoint base is mounted in the route layer',
    (_id, _name, mod) => {
      const base = baseMount(mod.endpoints[0]);
      expect(base.length).toBeGreaterThan(0);
      // The base appears as a router mount: `'/base'` or `'/api/base'` or `'/v8.../base'`.
      const mounted = new RegExp(`['"\`]/(?:api/)?(?:v8/(?:[a-z0-9-]+/)*)?${base}['"\`/]`).test(allSource)
        || allSource.includes(`'/${base}'`)
        || allSource.includes(`'/api/${base}'`);
      expect(mounted, `endpoint base '${base}' (${mod.endpoints[0]}) not found as a mount`).toBe(true);
    }
  );

  it('every module declares a known access tier', () => {
    const tiers = new Set(['open', 'beta', 'internal', 'role', 'stub']);
    for (const m of MODULES) expect(tiers.has(m.access)).toBe(true);
  });
});
